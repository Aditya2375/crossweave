package crossweave;

public final class Engine {
  private Engine() {}
  public record Input(String scenario,int window,int end,long seed) {}
  public record Pair(double r,double covariance,double meanX,double meanY,double sdX,double sdY) {}
  public record Result(Input input,double[][] data,Pair[][] matrix,Pair[][] baseline) {}
  public static void validate(Input p) {
    if(p==null||!("flip".equals(p.scenario)||"steady".equals(p.scenario)||"flat".equals(p.scenario))
        ||(p.window!=40&&p.window!=80&&p.window!=120)||p.end<p.window||p.end>240
        ||p.seed<1||p.seed>4294967295L) throw new IllegalArgumentException("outside model domain");
  }
  private static final class Rng {
    int s; Rng(long seed){s=(int)seed;}
    double next(){s^=s<<13;s^=s>>>17;s^=s<<5;return (Integer.toUnsignedLong(s)/4294967296.0*2-1)*Math.sqrt(3);}
  }
  public static double[][] generate(Input p){
    validate(p);Rng rng=new Rng(p.seed);double[][] d=new double[6][240];
    for(int t=0;t<240;t++){
      double f=rng.next(),a=rng.next(),b=rng.next(),c=rng.next(),e=rng.next(),h=rng.next();
      d[0][t]=f;d[1][t]=((p.scenario.equals("flip")&&t>=120)?-.8:.8)*f+.6*a;
      d[2][t]=-.6*f+.8*b;d[3][t]=.7*c+.3*a;d[4][t]=f*f-1+.25*e;d[5][t]=p.scenario.equals("flat")?0:h;
    }return d;
  }
  private static double sum(double[] x){double s=0,c=0;for(double a:x){double y=a-c,t=s+y;c=(t-s)-y;s=t;}return s;}
  public static Pair pair(double[] x,double[] y,int start,int end){
    if(x==null||y==null||x.length!=y.length||x.length>240||start<0||end>x.length||end-start<2)throw new IllegalArgumentException("invalid series/window");
    int n=end-start;double[] dx=new double[n],dy=new double[n];boolean cx=true,cy=true;
    for(int k=0;k<n;k++){double a=x[start+k],b=y[start+k];if(!Double.isFinite(a)||!Double.isFinite(b)||Math.abs(a)>1e6||Math.abs(b)>1e6)throw new IllegalArgumentException("invalid value");dx[k]=a-x[start];dy[k]=b-y[start];cx&=a==x[start];cy&=b==y[start];}
    double mx=sum(dx)/n,my=sum(dy)/n;double[] xx=new double[n],yy=new double[n],xy=new double[n];
    for(int k=0;k<n;k++){double a=dx[k]-mx,b=dy[k]-my;xx[k]=a*a;yy[k]=b*b;xy[k]=a*b;}
    double sx=cx?0:sum(xx),sy=cy?0:sum(yy),cxy=(cx||cy)?0:sum(xy);
    double r=(sx==0||sy==0)?Double.NaN:Math.max(-1,Math.min(1,cxy/(Math.sqrt(sx)*Math.sqrt(sy))));
    return new Pair(r,cxy/(n-1),x[start]+mx,y[start]+my,Math.sqrt(sx/(n-1)),Math.sqrt(sy/(n-1)));
  }
  public static Pair[][] matrix(double[][] d,int start,int end){
    Pair[][] m=new Pair[6][6];for(int i=0;i<6;i++)for(int j=0;j<6;j++)m[i][j]=pair(d[i],d[j],start,end);return m;
  }
  public static Result run(Input p){double[][] d=generate(p);return new Result(p,d,matrix(d,p.end-p.window,p.end),matrix(d,0,p.window));}
  public static double[] rolling(Result r,int i,int j){
    if(i<0||i>5||j<0||j>5)throw new IllegalArgumentException("invalid pair");int w=r.input.window;double[] a=new double[241-w];for(int end=w;end<=240;end++)a[end-w]=pair(r.data[i],r.data[j],end-w,end).r;return a;
  }
}
