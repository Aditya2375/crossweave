package crossweave;
public final class TestRunner {
 static int n=0;static void ok(boolean b){n++;if(!b)throw new AssertionError("check "+n);}static void near(double a,double b,double tol){ok(Math.abs(a-b)<=tol);}static void rejects(Runnable r){boolean b=false;try{r.run();}catch(IllegalArgumentException e){b=true;}ok(b);}
 public static void main(String[] args){
  double[] a={1,2,3,4},b={9,7,5,3},c={.667,.667,.667,.667};var z=Engine.pair(a,b,0,4);near(z.r(),-1,1e-14);near(z.covariance(),-10./3,1e-14);near(z.meanX(),2.5,1e-14);near(z.sdX(),Math.sqrt(5./3),1e-14);ok(Double.isNaN(Engine.pair(a,c,0,4).r()));ok(Double.isNaN(Engine.pair(c,c,0,4).r()));near(Engine.pair(new double[]{-2,-1,0,1,2},new double[]{4,1,0,1,4},0,5).r(),0,1e-14);
  for(String s:new String[]{"steady","flip","flat"})for(int w:new int[]{40,80,120})for(long seed:new long[]{1,2026,4294967295L})for(int end:new int[]{w,120,240}){
    var p=new Engine.Input(s,w,end,seed);var r=Engine.run(p);for(int i=0;i<6;i++)for(int j=0;j<6;j++){var q=r.matrix()[i][j];if(s.equals("flat")&&(i==5||j==5)){ok(Double.isNaN(q.r()));near(q.covariance(),0,0);}else{ok(Double.isFinite(q.r())&&Math.abs(q.r())<=1);near(q.r(),r.matrix()[j][i].r(),1e-14);if(i==j)near(q.r(),1,5e-15);}near(q.covariance(),r.matrix()[j][i].covariance(),1e-14);var roll=Engine.rolling(r,i,j);ok(roll.length==241-w);if(Double.isNaN(q.r()))ok(Double.isNaN(roll[end-w]));else near(roll[end-w],q.r(),1e-14);}
  }
  var f=Engine.run(new Engine.Input("flip",80,80,2026));ok(f.matrix()[0][1].r()>.6);var g=Engine.run(new Engine.Input("flip",80,240,2026));ok(g.matrix()[0][1].r()<-.6);
  rejects(()->Engine.run(new Engine.Input("x",80,200,2)));rejects(()->Engine.run(new Engine.Input("flip",30,200,2)));rejects(()->Engine.run(new Engine.Input("flip",80,79,2)));rejects(()->Engine.run(new Engine.Input("flip",80,241,2)));for(long seed:new long[]{0,4294967296L})rejects(()->Engine.run(new Engine.Input("flip",80,200,seed)));rejects(()->Engine.pair(new double[]{1,Double.NaN},new double[]{1,2},0,2));rejects(()->Engine.pair(a,b,2,3));rejects(()->Engine.rolling(f,-1,0));System.out.println(n+" Java checks passed");
 }
}
