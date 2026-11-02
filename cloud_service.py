"""AttendPro Supabase REST/Auth adapter. Never opens or writes a ZKTeco MDB.

All elevated API calls stay on the FastAPI server; no service key is shipped to HTML.
The service-key-backed methods are only reachable behind server authorization.
"""
from __future__ import annotations
import hashlib, os, time
from urllib.parse import quote
from dataclasses import dataclass
import httpx
from fastapi import HTTPException
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent/'.env',override=False)

ROLES=('view_only','supervisor','super_admin')

@dataclass
class Settings:
    url:str
    public_key:str
    secret_key:str

    @classmethod
    def from_env(cls):
        return cls(os.getenv('SUPABASE_URL','').rstrip('/'),
                   os.getenv('SUPABASE_PUBLISHABLE_KEY',''),os.getenv('SUPABASE_SECRET_KEY',''))

    def validate(self):
        if not (self.url.startswith('https://') and self.public_key and self.secret_key):
            raise RuntimeError('Supabase mode needs SUPABASE_URL (HTTPS), SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY')

class CloudError(RuntimeError):pass

class CloudService:
    def __init__(self,settings:Settings=None,transport=None):
        self.settings=settings or Settings.from_env()
        self.settings.validate()
        self.client=httpx.Client(timeout=22,transport=transport)
        self.user_cache={}

    def _call(self,method,path,*,secret=True,token=None,params=None,payload=None,headers=None):
        key=self.settings.secret_key if secret else self.settings.public_key
        head={'apikey':key,'Accept':'application/json'}
        if token:head['Authorization']='Bearer '+token
        elif key.startswith('eyJ'):head['Authorization']='Bearer '+key  # legacy JWT key compatibility only
        if payload is not None:head['Content-Type']='application/json'
        if headers:head.update(headers)
        try:
            r=self.client.request(method,self.settings.url+path,headers=head,params=params,json=payload)
        except (httpx.TimeoutException,httpx.ConnectError,httpx.NetworkError) as e:
            raise CloudError('Supabase is unreachable; the update was not saved: '+str(e)) from e
        if r.status_code>=400:
            try:detail=r.json();msg=detail.get('msg') or detail.get('message') or detail.get('error_description') or detail.get('error') or r.text[:250]
            except ValueError:msg=r.text[:250]
            raise CloudError(f'Supabase HTTP {r.status_code}: {msg}')
        if not r.content:return None
        try:return r.json()
        except ValueError:return None

    def rest(self,method,table,params=None,payload=None,headers=None):
        return self._call(method,'/rest/v1/'+quote(table,safe=''),params=params,payload=payload,headers=headers)

    def upsert(self,table,rows,conflict):
        if isinstance(rows,dict):rows=[rows]
        if not rows:return []
        result=[]
        for i in range(0,len(rows),100):
            result+=self.rest('POST',table,params={'on_conflict':conflict},payload=rows[i:i+100],
                  headers={'Prefer':'resolution=merge-duplicates,return=representation'}) or []
        return result

    def rows(self,table,params=None):
        params=dict(params or {});out=[];offset=0
        while True:
            q={**params,'limit':500,'offset':offset}
            chunk=self.rest('GET',table,params=q) or []
            out.extend(chunk)
            if len(chunk)<500:break
            offset+=500
        return out

    def one(self,table,params=None):
        result=self.rest('GET',table,params={**(params or {}),'limit':1}) or []
        return result[0] if result else None

    def patch(self,table,params,values):
        return self.rest('PATCH',table,params=params,payload=values,headers={'Prefer':'return=representation'}) or []

    def rpc(self,name,values):
        return self._call('POST','/rest/v1/rpc/'+quote(name,safe=''),payload=values)

    # Supabase Auth: login via public key, user verification against Auth server.
    def login(self,email,password):
        return self._call('POST','/auth/v1/token',secret=False,params={'grant_type':'password'},
                          payload={'email':email,'password':password})
    def refresh(self,refresh_token):
        return self._call('POST','/auth/v1/token',secret=False,params={'grant_type':'refresh_token'},
                          payload={'refresh_token':refresh_token})
    def get_auth_user(self,access_token):
        # An actual Auth server verification, not an unverified JWT decode.
        return self._call('GET','/auth/v1/user',secret=False,token=access_token)
    def update_password(self,access_token,password):
        return self._call('PUT','/auth/v1/user',secret=False,token=access_token,payload={'password':password})
    def admin_create(self,email,password):
        return self._call('POST','/auth/v1/admin/users',payload={
            'email':email,'password':password,'email_confirm':True})
    def admin_update(self,auth_id,values):
        return self._call('PUT','/auth/v1/admin/users/'+quote(str(auth_id),safe=''),payload=values)
    def admin_delete(self,auth_id):
        return self._call('DELETE','/auth/v1/admin/users/'+quote(str(auth_id),safe=''))

    def identity(self,access_token,force=False):
        if not access_token:return None
        digest=hashlib.sha256(access_token.encode()).hexdigest()
        now=time.monotonic()
        old=self.user_cache.get(digest)
        if old and old[0]>now and not force:return dict(old[1])
        try:user=self.get_auth_user(access_token)
        except CloudError:return None
        if not isinstance(user,dict) or not user.get('id'):return None
        profile=self.one('attendpro_app_users',{'auth_id':'eq.'+str(user['id'])})
        if not profile or not profile.get('active'):return None
        result={'id':str(profile['auth_id']),'auth_id':str(profile['auth_id']),
           'username':str(profile['email']),'display_name':profile['display_name'],
           'role':profile['role'],'email':profile['email']}
        self.user_cache[digest]=(now+8,result)
        if len(self.user_cache)>3000:self.user_cache.clear()
        return result

    def save_adjustment(self,employee_id,work_date,after,actor_id,action,reason,expected_version=None):
        # Single Postgres transaction through SQL RPC: override + append-only audit.
        return self.rpc('attendpro_save_correction',{
            'p_employee_id':int(employee_id),'p_work_date':work_date,
            'p_after':after,'p_actor':actor_id,'p_action':action,'p_reason':reason,
            'p_expected_version':expected_version})

    def save_review(self,values):
        return self.upsert('attendpro_discrepancy_reviews',values,'employee_id,work_date,issue_type')

CLOUD_ENABLED=os.getenv('SUPABASE_ENABLED','0').lower() in ('1','true','yes')
cloud=CloudService() if CLOUD_ENABLED else None

def cloud_or_503(action):
    try:return action()
    except CloudError as e:raise HTTPException(status_code=503,detail=str(e)) from e
