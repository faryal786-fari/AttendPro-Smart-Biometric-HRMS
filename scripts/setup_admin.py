#!/usr/bin/env python3
"""One-time secure bootstrap for an AttendPro Supabase Super Admin.
Requires schema SQL applied first. Never sends or prints the chosen password.
"""
import argparse, getpass, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cloud_service import CLOUD_ENABLED,cloud,CloudError

def main():
 p=argparse.ArgumentParser();p.add_argument('--email',required=True);p.add_argument('--name',required=True)
 args=p.parse_args()
 if not CLOUD_ENABLED:sys.exit('Set SUPABASE_ENABLED=1 and configure .env first')
 if '@' not in args.email:sys.exit('Enter a valid email address')
 password=getpass.getpass('New Super Admin password (minimum 12 chars): ')
 if len(password)<12:sys.exit('Password too short: use at least 12 characters')
 confirm=getpass.getpass('Confirm password: ')
 if password != confirm:sys.exit('Passwords do not match')
 exists=cloud.rows('attendpro_app_users')
 if exists:sys.exit('A user already exists. Use System Users or Supabase Dashboard; do not run bootstrap twice.')
 try:
  created=cloud.admin_create(args.email,password)
  uid=created.get('id') or created.get('user',{}).get('id')
  try:cloud.upsert('attendpro_app_users',{'auth_id':uid,'email':args.email.lower(),
        'display_name':args.name,'role':'super_admin','active':True},'auth_id')
  except CloudError:
   cloud.admin_delete(uid)
   raise
 except (CloudError,KeyError) as exc:sys.exit('Bootstrap failed: '+str(exc))
 print('Success. Super Admin created in Supabase Auth + attendpro_app_users.')
 print('Open http://127.0.0.1:8000 and sign in with your EMAIL and password.')
if __name__=='__main__':main()
