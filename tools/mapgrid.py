# 战场实景底图：从 PRTS 收录的原始截图（910×512）裁出战场附近 820×410，压成 WebP，
# 并按“格子中心 → 截图像素”的人工锚点拟合格子外框在底图上的四角（透视，上下边水平）。
# 用法：python tools/mapgrid.py <原始截图目录> 。原图文件名 mNN_K.png（卫戍协议规程_战场NN_场地K_地图.png）
import json,sys,os
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'..','src','mapimg')
CW,CH=820,410
def solve(A,b):
    n=len(A); M=[row[:]+[bb] for row,bb in zip(A,b)]
    for i in range(n):
        p=max(range(i,n),key=lambda r:abs(M[r][i])); M[i],M[p]=M[p],M[i]
        for r in range(n):
            if r!=i:
                f=M[r][i]/M[i][i]; M[r]=[a-f*c for a,c in zip(M[r],M[i])]
    return [M[i][n]/M[i][i] for i in range(n)]
def fitH(pts):  # 最小二乘单应
    M=[[0.0]*8 for _ in range(8)]; v=[0.0]*8
    for (x,y),(u,w) in pts:
        for row,b in (([x,y,1,0,0,0,-u*x,-u*y],u),([0,0,0,x,y,1,-w*x,-w*y],w)):
            for i in range(8):
                v[i]+=row[i]*b
                for j in range(8): M[i][j]+=row[i]*row[j]
    return solve(M,v)+[1]
def proj(h,x,y): w=h[6]*x+h[7]*y+1; return ((h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w)
def fit(anchors):
    # 锚点 [列, 行(从上数), x, y] 是格子中心；外框 (0,0)-(9,4)
    P=[((c+0.5,r+0.5),(x,y)) for c,r,x,y in anchors]
    h0=fitH(P); q=[proj(h0,0,4),proj(h0,9,4),proj(h0,9,0),proj(h0,0,0)]
    p=[(q[0][1]+q[1][1])/2,(q[2][1]+q[3][1])/2,q[0][0],q[1][0],q[3][0],q[2][0]]
    Hp=lambda p:fitH([((0,4),(p[2],p[0])),((9,4),(p[3],p[0])),((9,0),(p[5],p[1])),((0,0),(p[4],p[1]))])
    cost=lambda p:sum((proj(Hp(p),*a)[0]-b[0])**2+(proj(Hp(p),*a)[1]-b[1])**2 for a,b in P)
    step=4.0
    while step>0.01:
        imp=False
        for i in range(6):
            for d in (step,-step):
                t=p[:]; t[i]+=d
                if cost(t)<cost(p): p=t; imp=True
        if not imp: step/=2
    return [(p[2],p[0]),(p[3],p[0]),(p[5],p[1]),(p[4],p[1])]  # 左下、右下、右上、左上
if __name__=='__main__':
    src=sys.argv[1]; cfg=json.load(open(os.path.join(HERE,'map-anchors.json'),encoding='utf8'))
    cams={k:fit(v) for k,v in cfg['anchors'].items()}
    out={'w':CW,'h':CH,'quad':{}}
    for key,cam in cfg['camera'].items():
        q=cams[cam]; cx=sum(x for x,_ in q)/4; cy=sum(y for _,y in q)/4
        im=Image.open(os.path.join(src,key+'.png')).convert('RGB')
        x0=int(round(min(max(cx-CW/2,0),im.width-CW))); y0=int(round(min(max(cy-CH/2+12,0),im.height-CH)))
        im.crop((x0,y0,x0+CW,y0+CH)).save(os.path.join(OUT,key+'.webp'),'WEBP',quality=76,method=6)
        out['quad'][key]=[[round(x-x0,1),round(y-y0,1)] for x,y in q]
    json.dump(out,open(os.path.join(OUT,'quad.json'),'w'))
    print('ok',len(out['quad']))
