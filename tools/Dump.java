import crossweave.Engine;
public class Dump {
 static void v(double x){System.out.print(Double.isFinite(x)?Double.toString(x):"null");}
 static void a(double[] d){System.out.print("[");for(int k=0;k<d.length;k++){if(k>0)System.out.print(",");v(d[k]);}System.out.print("]");}
 static void p(Engine.Pair p){System.out.print("[");v(p.r());System.out.print(",");v(p.covariance());System.out.print(",");v(p.meanX());System.out.print(",");v(p.meanY());System.out.print(",");v(p.sdX());System.out.print(",");v(p.sdY());System.out.print("]");}
 public static void main(String[] args){var z=Engine.run(new Engine.Input(args[0],Integer.parseInt(args[1]),Integer.parseInt(args[2]),Long.parseLong(args[3])));System.out.print("{\"data\":[");for(int i=0;i<6;i++){if(i>0)System.out.print(",");a(z.data()[i]);}System.out.print("],\"matrix\":[");for(int i=0;i<6;i++)for(int j=0;j<6;j++){if(i+j>0)System.out.print(",");p(z.matrix()[i][j]);}System.out.print("],\"baseline\":[");for(int i=0;i<6;i++)for(int j=0;j<6;j++){if(i+j>0)System.out.print(",");p(z.baseline()[i][j]);}System.out.print("],\"rolling\":[");for(int i=0;i<6;i++)for(int j=0;j<6;j++){if(i+j>0)System.out.print(",");a(Engine.rolling(z,i,j));}System.out.println("]}");}
}
