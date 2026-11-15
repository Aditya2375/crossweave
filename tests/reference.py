"""Independent NumPy covariance/eigenvalues, SciPy correlation, Python generator."""
import json,subprocess,math
import numpy as np
from scipy.stats import pearsonr
checks=0;maxerr=0
for c in json.loads(subprocess.check_output(['node','tools/dump.mjs'],text=True)):
 p=c['input'];d=np.array(c['data']);w=p['window'];end=p['end'];state=p['seed'];ref=np.zeros((6,240))
 def nxt():
  global state
  state=(state^(state<<13))&0xffffffff;state=(state^(state>>17))&0xffffffff;state=(state^(state<<5))&0xffffffff
  return (state/4294967296*2-1)*math.sqrt(3)
 for t in range(240):
  f,a,b,k,e,h=[nxt()for _ in range(6)];ref[:,t]=[f,(-.8 if p['scenario']=='flip'and t>=120 else .8)*f+.6*a,-.6*f+.8*b,.7*k+.3*a,f*f-1+.25*e,0 if p['scenario']=='flat'else h]
 assert np.array_equal(d,ref);checks+=1440
 def compare(q,a,b):
  global checks,maxerr
  constant=np.ptp(a)==0 or np.ptp(b)==0
  assert (q['r']is None)==constant;checks+=1
  vals={'covariance':float(np.cov(a,b,ddof=1)[0,1]),'meanX':a.mean(),'meanY':b.mean(),'sdX':a.std(ddof=1),'sdY':b.std(ddof=1)}
  if not constant:vals['r']=pearsonr(a,b).statistic
  for key,v in vals.items():
   err=abs(q[key]-v)/max(1,abs(v));maxerr=max(err,maxerr);assert err<2e-12,(key,q[key],v);checks+=1
 for start,stop,key in [(end-w,end,'matrix'),(0,w,'baseline')]:
  x=d[:,start:stop];cov=np.cov(x,ddof=1);assert np.linalg.eigvalsh(cov).min()>-1e-12;checks+=1
  for i in range(6):
   for j in range(6):compare(c[key][i][j],x[i],x[j])
 # All trailing endpoints for three distinct pairs including flat-signal handling.
 for i,j in [(0,1),(0,4),(0,5)]:
  for k,r in enumerate(c['rolling'][6*i+j]):
   a=d[i,k:k+w];b=d[j,k:k+w]
   if np.ptp(a)==0 or np.ptp(b)==0:assert r is None
   else:assert abs(r-pearsonr(a,b).statistic)<2e-12
   checks+=1
print(f'{checks} independent NumPy/SciPy/Python checks; max scaled difference {maxerr:.3g}')
