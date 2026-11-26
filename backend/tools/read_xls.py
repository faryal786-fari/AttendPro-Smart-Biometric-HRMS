"""Small standard-library BIFF8 .xls reader for the two provided ZKTeco report files.
Does not write source files. For general-purpose XLS use an export from Excel to CSV.
"""
import struct, sys, csv
from datetime import datetime, timedelta
from pathlib import Path

def u16(b, at=0): return struct.unpack_from('<H', b, at)[0]
def u32(b, at=0): return struct.unpack_from('<I', b, at)[0]

class Compound:
 def __init__(self, path):
  self.raw=path if isinstance(path,bytes) else Path(path).read_bytes(); h=self.raw[:512]; self.size=1<<u16(h,30);self.cut=u32(h,56)
  self.difat=[u32(h,76+i*4) for i in range(109) if u32(h,76+i*4)<0xFFFFFFFA]
  next_difat=u32(h,68)
  for _ in range(u32(h,72)):
   s=self.sector(next_difat)
   self.difat += [u32(s,i*4) for i in range((self.size//4)-1) if u32(s,i*4)<0xFFFFFFFA]
   next_difat=u32(s,self.size-4)
  self.fat=[]
  for i in self.difat: self.fat += list(struct.unpack('<'+'I'*(self.size//4),self.sector(i)))
  self.directory=self.chain(u32(h,48))
  self.entries=[]
  for off in range(0,len(self.directory),128):
   d=self.directory[off:off+128]
   if len(d)<128:break
   n=u16(d,64); name=d[:max(0,n-2)].decode('utf-16le',errors='replace')
   self.entries.append({'name':name,'type':d[66],'start':u32(d,116),'size':struct.unpack_from('<Q',d,120)[0]})
  root=next((e for e in self.entries if e['type']==5),None)
  self.ministream=self.chain(root['start'])[:root['size']] if root else b''
  mini_start=u32(h,60); mini_count=u32(h,64)
  self.minifat=list(struct.unpack('<'+'I'*(len(self.chain(mini_start))//4),self.chain(mini_start))) if mini_count and mini_start<0xFFFFFFFA else []
 def sector(self,i):return self.raw[512+i*self.size:512+(i+1)*self.size]
 def chain(self,start):
  out=bytearray();seen=set();p=start
  while p < 0xFFFFFFFA and p not in seen and p<len(self.fat):
   seen.add(p);out.extend(self.sector(p));p=self.fat[p]
  return bytes(out)
 def stream(self,name):
  e=next(e for e in self.entries if e['name'].lower()==name.lower())
  if e['size']>=self.cut:return self.chain(e['start'])[:e['size']]
  out=bytearray();seen=set();p=e['start']
  while p<0xFFFFFFFA and p not in seen and p<len(self.minifat):
   seen.add(p);out+=self.ministream[p*64:(p+1)*64];p=self.minifat[p]
  return bytes(out[:e['size']])

def records(buf, pos=0):
 while pos+4<=len(buf):
  rid,n=struct.unpack_from('<HH',buf,pos);begin=pos;pos+=4
  if pos+n>len(buf):break
  yield begin,rid,buf[pos:pos+n]
  pos+=n

def xl_string(buf,pos=0,short=False):
 length=buf[pos] if short else u16(buf,pos);pos+=1 if short else 2
 flags=buf[pos];pos+=1
 if flags & 8:pos+=2
 if flags & 4:pos+=4
 if flags & 1:
  return buf[pos:pos+length*2].decode('utf-16le',errors='replace'),pos+length*2
 return buf[pos:pos+length].decode('latin-1',errors='replace'),pos+length

def get_sst(all_rec):
 # Most BIFF8 exports split SST records on boundaries; if a string spans a CONTINUE
 # a 1-byte compression option is emitted at beginning of continuation.
 for j,(_,r,d) in enumerate(all_rec):
  if r!=0xFC:continue
  chunks=[d];k=j+1
  while k<len(all_rec) and all_rec[k][1]==0x3C:
   chunks.append(all_rec[k][2]);k+=1
  n=u32(d,4); text=[]
  # Stateful reader handles split strings across BIFF CONTINUE boundaries.
  ci=0;off=8
  def raw(count):
   nonlocal ci,off
   v=bytearray()
   while count>0 and ci<len(chunks):
    if off==len(chunks[ci]): ci+=1;off=0;continue
    take=min(count,len(chunks[ci])-off);v.extend(chunks[ci][off:off+take]);off+=take;count-=take
   return bytes(v)
  def chars(nchars,unicode):
   nonlocal ci,off
   v=[]
   while nchars>0 and ci<len(chunks):
    if off>=len(chunks[ci]):
     ci+=1;off=0
     if ci>=len(chunks):break
     unicode=bool(raw(1)[0] & 1)
    wide=2 if unicode else 1
    can=(len(chunks[ci])-off)//wide
    if can<=0:
     ci+=1;off=0
     if ci<len(chunks):unicode=bool(raw(1)[0]&1)
     continue
    take=min(nchars,can);data=raw(take*wide);v.append(data.decode('utf-16le' if wide==2 else 'latin-1',errors='replace'));nchars-=take
   return ''.join(v)
  for _ in range(n):
   h=raw(3)
   if len(h)<3:break
   length=u16(h);flags=h[2];rich=u16(raw(2)) if flags&8 else 0;extra=u32(raw(4)) if flags&4 else 0
   s=chars(length,bool(flags&1))
   if rich:raw(rich*4)
   if extra:raw(extra)
   text.append(s)
  return text
 return []

def get_sheets(path):
 wb=Compound(path);stream=wb.stream('Workbook' if any(e['name']=='Workbook' for e in wb.entries) else 'Book')
 allrec=list(records(stream));strings=get_sst(allrec); sheetmeta=[]
 for pos,r,d in allrec:
  if r==0x85:
   n=d[6];flags=d[7];name=d[8:8+n*2].decode('utf-16le',errors='replace') if flags&1 else d[8:8+n].decode('latin-1',errors='replace')
   sheetmeta.append((name,u32(d)))
 result={}
 for name,start in sheetmeta:
  cells={}
  for pos,r,d in records(stream,start):
   if pos>start and r==0x0A:break
   if r==0xFD and len(d)>=10:
    row,col=struct.unpack_from('<HH',d); idx=u32(d,6);cells[(row,col)]=strings[idx] if idx<len(strings) else ''
   elif r==0x203 and len(d)>=14:
    row,col=struct.unpack_from('<HH',d);cells[(row,col)]=struct.unpack_from('<d',d,6)[0]
   elif r==0x27E and len(d)>=10:
    row,col=struct.unpack_from('<HH',d);rk=u32(d,6);num=0.0
    if rk&2:num=float(struct.unpack('<i',struct.pack('<I',rk))[0]>>2)
    else:num=struct.unpack('<d',struct.pack('<Q',(rk&0xFFFFFFFC)<<32))[0]
    if rk&1:num/=100
    cells[(row,col)]=num
   elif r==0xBD and len(d)>=6:
    row,startcol=struct.unpack_from('<HH',d);endcol=u16(d,len(d)-2)
    for col in range(startcol,endcol+1):
     x=4+6*(col-startcol);rk=u32(d,x+2)
     num=float(struct.unpack('<i',struct.pack('<I',rk))[0]>>2) if rk&2 else struct.unpack('<d',struct.pack('<Q',(rk&0xFFFFFFFC)<<32))[0]
     if rk&1:num/=100
     cells[(row,col)]=num
   elif r==0x06 and len(d)>=14:
    row,col=struct.unpack_from('<HH',d);v=d[6:14]
    if v[6:8]!=b'\xff\xff':cells[(row,col)]=struct.unpack('<d',v)[0]
   elif r==0x204 and len(d)>=8:
    row,col=struct.unpack_from('<HH',d);n=u16(d,6);cells[(row,col)]=d[8:8+n].decode('latin-1',errors='replace')
  if cells:
   maxrow=max(r for r,c in cells);maxcol=max(c for r,c in cells)
   result[name]=[[cells.get((r,c),'') for c in range(maxcol+1)] for r in range(maxrow+1)]
  else:result[name]=[]
 return result

if __name__=='__main__':
 for path in sys.argv[1:]:
  print('FILE',path)
  sheets=get_sheets(path)
  for name,rows in sheets.items():
   print('SHEET',repr(name),'ROWS',len(rows),'COLS',max((len(r) for r in rows),default=0))
   for i,row in enumerate(rows[:14]): print(i,repr(row[:16]))
