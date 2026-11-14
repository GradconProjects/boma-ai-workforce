export const initialBrands = [
 {id:'concrete',name:'Concrete Estimating Platform',tagline:'From drawings to submitted tender, in one place.',industry:'Construction technology',audience:'Australian concrete contractors, estimators and subcontractors',tone:'Confident, practical, precise',primary:'#102037',accent:'#E8A160',secondary:'#233C52',logo:'CE',website:'',contact:'',features:['70 takeoff element types','17 specialist takeoff calculators','412 catalogue products','8 integrated modules','AI-assisted document review with human approval','Tender documents without retyping']},
 {id:'cynthus',name:'Cynthus Collections',tagline:'Flavours worth gathering for.',industry:'Food & catering',audience:'Families and event organisers in Melbourne',tone:'Warm, inviting, vibrant',primary:'#412637',accent:'#E6A56D',secondary:'#785249',logo:'CC',website:'',contact:'',features:['African-inspired cuisine','Bulk meal orders','Event catering','Nigerian favourites','Enquiries and custom orders']}
];
export const formats = [
 {id:'flyer',title:'Promotional flyer',subtitle:'A4 / poster',kind:'design',ratio:'portrait'},
 {id:'social',title:'Social media post',subtitle:'Square / feed',kind:'design',ratio:'square'},
 {id:'story',title:'Story / Reel cover',subtitle:'9:16 vertical',kind:'design',ratio:'story'},
 {id:'advert',title:'Digital advertisement',subtitle:'Landscape creative',kind:'design',ratio:'wide'},
 {id:'document',title:'Business document',subtitle:'Company profile / proposal',kind:'document',ratio:'portrait'},
 {id:'video',title:'Video storyboard',subtitle:'Scene-based production',kind:'video',ratio:'wide'}
];
export const starterCampaigns = [
 {name:'Product introduction',goal:'Introduce our service and explain its main benefits',audience:'Potential customers',cta:'Learn more'},
 {name:'Feature spotlight',goal:'Highlight the practical value of one key feature',audience:'Professionals comparing solutions',cta:'See how it works'},
 {name:'Brand awareness',goal:'Build awareness and trust with a clear value proposition',audience:'New customers',cta:'Explore our services'},
 {name:'Customer enquiry',goal:'Encourage qualified leads to request more information',audience:'People ready to enquire',cta:'Get in touch'}
];
export const uid=()=>globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const defaultContent=(brand,format,brief='')=>({
 eyebrow:format==='advert'?'A SMARTER WAY TO WORK':brand.industry.toUpperCase(),
 headline:brand.tagline.split(',')[0].replace(/\.$/,''),
 subhead:brief?.trim()?brief.trim().slice(0,160):`${brand.features.slice(0,3).join(' · ')}.`,
 cta:format==='document'?'Discover our capabilities':'Explore the platform',
 footer:brand.name,
 bullets:brand.features.slice(0,5),
 body:`${brand.name} brings together the tools and expertise that matter. ${brand.features.slice(0,3).join('. ')}. Built for ${brand.audience.toLowerCase()}.`,
 scenes:[
  {title:'The challenge',caption:'What if the old process could be simpler?',duration:5},
  {title:'Meet the solution',caption:brand.tagline,duration:7},
  {title:'Made for your workflow',caption:brand.features.slice(0,2).join(' • '),duration:8},
  {title:'See what is possible',caption:brand.features.slice(2,4).join(' • '),duration:6},
  {title:'Take the next step',caption:'Explore our platform and get in touch.',duration:4}
 ]
});
export function createProject(brand,format,brief=''){
 const formatObj=formats.find(f=>f.id===format)||formats[0];
 return {id:uid(),brandId:brand.id,format,title:`${formatObj.title} · ${new Date().toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`,brief,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),content:defaultContent(brand,format,brief),style:{primary:brand.primary,accent:brand.accent,secondary:brand.secondary,theme:'dark',align:'left',template:'editorial'},layers:[]};
}
export function buildCampaign(brand,goal,audience){
 const stamp=new Date().toISOString();const seed=`${goal}${audience?' — For '+audience:''}`;
 return ['flyer','social','advert','document','video'].map(format=>{const p=createProject(brand,format,seed);p.title=`${goal.substring(0,36)} — ${formats.find(f=>f.id===format).title}`;return p;});
}
