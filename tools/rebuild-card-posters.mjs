import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT=process.cwd();
const DATA=path.join(ROOT,'site','data','events.json');
const OUT=path.join(ROOT,'site','assets','posters','cards');
fs.mkdirSync(OUT,{recursive:true});

const SOURCES={
  '天猫ai黑客松高校挑战赛':[
    'https://www.aibetas.com/wp-content/uploads/2026/09/tmall_ai_hackathon_university_challenge_2026_cover.png',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E5%A4%A9%E7%8C%ABai%E9%BB%91%E5%AE%A2%E6%9D%BE-%E9%AB%98%E6%A0%A1%E6%8C%91%E6%88%98%E8%B5%9B-5a7674a103c6.png'
  ],
  '亚洲黑客松巅峰赛上海站':[
    'https://i.ytimg.com/vi/5QXRzH1wF-k/maxresdefault.jpg',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/arena-peak-asia-%E4%BA%9A%E6%B4%B2%E9%BB%91%E5%AE%A2%E6%9D%BE%E5%B7%85%E5%B3%B0%E8%B5%9B-%E4%B8%8A%E6%B5%B7%E7%AB%99-b10eac1481e3.jpg'
  ],
  '深圳-solar-黑客之家-solar-hacker-house-shenzhen':[
    'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=1,anim=false,background=white,quality=90,width=1200,height=630/event-social/h2/7d678608-4010-4d9e-898e-6361ba4b1689.png',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E6%B7%B1%E5%9C%B3-solar-%E9%BB%91%E5%AE%A2%E4%B9%8B%E5%AE%B6-solar-hacker-house-shenzhen-671ce856c343.jpg'
  ],
  'tme-高校ai-hackathon':[
    'https://q8.itc.cn/q_70/images03/20260919/abf905b5fb1d4593a5d37e4d063ea231.jpeg',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E8%85%BE%E8%AE%AF%E9%9F%B3%E4%B9%90%E9%A6%96%E5%B1%8A%E9%AB%98%E6%A0%A1ai-hackathon-build-with-ai-1fd3d78f7857.jpg'
  ],
  '初焰-钠宙-s1':[
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E5%88%9D%E7%84%B0-%E9%92%A0%E5%AE%99-%E9%92%A0%E7%94%B5-aidc-%E7%BA%BF%E4%B8%8A%E9%BB%91%E5%AE%A2%E6%9D%BE-season-01-b9bdbd0acdf9.jpg'
  ],
  '苏客松-2026':[
    'https://img.36krcdn.com/hsossms/20261010/v2_30c4528092d64da99096e41c4e681b2e@6438729_oswg171423oswg1053oswg495_img_jpg?x-oss-process=image/resize,m_mfit,w_1200,h_800,limit_0/crop,w_1200,h_800,g_center',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E8%8B%8F%E5%AE%A2%E6%9D%BE-2026-su2026-%E8%8B%8F%E5%B7%9E-ai-%E9%BB%91%E5%AE%A2%E6%9D%BE-b19a3586502e.jpg'
  ],
  '蚂蚁灵波具身大模型挑战赛':[
    'https://pic.imgdb.cn/i/034OwpAsz7RKL3Xaoa5s2v.png',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E9%A6%96%E5%B1%8A%E8%9A%82%E8%9A%81%E7%81%B5%E6%B3%A2%E5%85%B7%E8%BA%AB%E5%A4%A7%E6%A8%A1%E5%9E%8B%E6%8C%91%E6%88%98%E8%B5%9B-6e4e349b94b0.png'
  ],
  'payathon-2026':[
    'https://mdn.alipayobjects.com/huamei_xyehqf/afts/img/8sPVS5vUIJMAAAAAQCAAAAgADvg4AQFr/original',
    'https://mdn.alipayobjects.com/huamei_xyehqf/afts/img/4giDSLLYgHYAAAAAQEAAAAgADvg4AQFr/original',
    'https://mdn.alipayobjects.com/huamei_xyehqf/afts/img/NATLT7af8P4AAAAAQFAAAAgADvg4AQFr/original',
    'https://mdn.alipayobjects.com/huamei_xyehqf/afts/img/PQ68TpAOnrIAAAAAQEAAAAgADvg4AQFr/original',
    'https://mdn.alipayobjects.com/huamei_xyehqf/afts/img/67HmT7u0NaoAAAAARlAAAAgADvg4AQFr/original',
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E6%94%AF%E4%BB%98%E5%AE%9Dai%E4%BB%98-payathon-2026-%E5%B9%B4%E5%BA%A6%E9%BB%91%E5%AE%A2%E6%9D%BE-7aee3ae65bf4.jpg'
  ],
  '雾客松-2027':[
    'https://pub-d7a436bb140a401a98a2b96d1850d970.r2.dev/hackathons/covers/%E9%9B%BE%E5%AE%A2%E6%9D%BE-2027-wakeathon-%E9%87%8D%E5%BA%86%E8%B7%A8%E5%B9%B4-ai-%E9%BB%91%E5%AE%A2%E6%9D%BE-47603359f78e.jpg'
  ]
};

const LOCAL_FALLBACK={
  '天猫ai黑客松高校挑战赛':'site/assets/posters/pe20e9d52bc.jpg',
  '亚洲黑客松巅峰赛上海站':'site/assets/posters/pb73295beb6.jpg',
  '深圳-solar-黑客之家-solar-hacker-house-shenzhen':'site/assets/posters/pf3df860e75.jpg',
  'tme-高校ai-hackathon':'site/assets/posters/pc35c8e47e8.jpg',
  '初焰-钠宙-s1':'site/assets/posters/p470045a0a2.jpg',
  '苏客松-2026':'site/assets/posters/p13aaf8e8d1.jpg',
  '蚂蚁灵波具身大模型挑战赛':'site/assets/posters/p0e4ac9f517.jpg',
  'payathon-2026':'site/assets/posters/pee8731918d.jpg',
  '雾客松-2027':'site/assets/posters/pf610346b2a.jpg'
};

function fileName(id){
  return crypto.createHash('md5').update(String(id)).digest('hex').slice(0,12)+'.jpg';
}
async function fetchBuf(url){
  const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 FutureMakerArena/1.0','accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}});
  if(!r.ok) throw new Error('HTTP '+r.status);
  const ct=r.headers.get('content-type')||'';
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length<3000) throw new Error('too small '+b.length);
  return {buf:b,ct,url:r.url};
}
async function candidate(url){
  try{
    const got=await fetchBuf(url);
    const meta=await sharp(got.buf,{failOn:'none'}).metadata();
    if(!meta.width||!meta.height) throw new Error('no dimensions');
    const ratio=meta.width/meta.height;
    const pixels=meta.width*meta.height;
    const ratioScore=Math.abs(Math.log(ratio/(16/9)));
    const sizePenalty=pixels<350000 ? 1.5 : pixels<700000 ? .5 : 0;
    const extremePenalty=(ratio<1.25||ratio>2.35)?2.0:0;
    return {...got,width:meta.width,height:meta.height,ratio,score:ratioScore+sizePenalty+extremePenalty};
  }catch(e){return {url,error:String(e.message||e),score:99}}
}
async function choose(event){
  const rows=[];
  for(const url of SOURCES[event.id]||[]) rows.push(await candidate(url));
  rows.sort((a,b)=>a.score-b.score);
  const best=rows.find(x=>!x.error);
  if(best && best.score<2.6) return {best,rows};
  const local=LOCAL_FALLBACK[event.id]&&path.join(ROOT,LOCAL_FALLBACK[event.id]);
  if(local&&fs.existsSync(local)){
    const buf=fs.readFileSync(local);
    const meta=await sharp(buf,{failOn:'none'}).metadata();
    return {best:{buf,url:'local:'+LOCAL_FALLBACK[event.id],width:meta.width,height:meta.height,ratio:meta.width/meta.height,score:9},rows};
  }
  throw new Error('No usable image source for '+event.id);
}
async function renderCard(event,src,out){
  const meta=await sharp(src.buf,{failOn:'none'}).metadata();
  const ratio=meta.width/meta.height;
  let position='centre';
  if(event.id==='tme-高校ai-hackathon') position='north';
  if(event.id==='苏客松-2026') position='centre';
  if(event.id==='蚂蚁灵波具身大模型挑战赛') position='centre';

  // Near-landscape sources receive only a small crop. Extreme legacy posters are only fallback.
  await sharp(src.buf,{failOn:'none'})
    .rotate()
    .resize(1200,675,{fit:'cover',position,withoutEnlargement:false})
    .jpeg({quality:91,mozjpeg:true})
    .toFile(out);
  return ratio;
}

const db=JSON.parse(fs.readFileSync(DATA,'utf8'));
const report=[];
for(const event of db.events||[]){
  try{
    const {best,rows}=await choose(event);
    const name=fileName(event.id);
    const out=path.join(OUT,name);
    await renderCard(event,best,out);
    event.cardPoster='assets/posters/cards/'+name;
    event.cardPosterSource=best.url;
    event.cardPosterUpdatedAt=new Date().toISOString();
    report.push({
      id:event.id,title:event.title,
      picked:best.url,sourceSize:best.width+'x'+best.height,
      ratio:Number(best.ratio.toFixed(3)),
      candidates:rows.map(x=>({url:x.url,size:x.width?x.width+'x'+x.height:null,ratio:x.ratio?Number(x.ratio.toFixed(3)):null,error:x.error||null,score:Number(x.score.toFixed?.(3)??x.score)}))
    });
    console.log('CARD',event.title,'<-',best.width+'x'+best.height,best.url);
  }catch(e){
    console.error('CARD FAILED',event.title,e.message);
    process.exitCode=1;
  }
}
fs.writeFileSync(DATA,JSON.stringify(db,null,2)+'\n');
fs.writeFileSync(path.join(OUT,'sources.json'),JSON.stringify(report,null,2)+'\n');
if(process.exitCode) process.exit(process.exitCode);
