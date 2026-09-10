const express=require('express');
const helmet=require('helmet');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const app=express();
const DB=path.join(__dirname,'rewards-data.json');
let data={users:[],tasks:[{id:'daily',name:'المهمة اليومية',points:500,active:1},{id:'bonus',name:'المهمة الإضافية',points:1000,active:1}],completions:[],ledger:[],redemptions:[]};
try{if(fs.existsSync(DB))data=JSON.parse(fs.readFileSync(DB,'utf8'));}catch(e){}
const save=()=>fs.writeFileSync(DB,JSON.stringify(data,null,2));
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'20kb'}));
app.use(express.static(path.join(__dirname,'public')));
const now=()=>new Date().toISOString();
const get=u=>data.users.find(x=>x.id===u);
function auth(req,res,next){const uid=req.headers['x-user-id'];if(!uid)return res.status(401).json({error:'يجب تسجيل الدخول'});const u=get(uid);if(!u)return res.status(401).json({error:'الحساب غير موجود'});req.uid=uid;req.user=u;next();}
app.post('/api/register',(req,res)=>{const username=String(req.body.username||'').trim().slice(0,40);if(!username)return res.status(400).json({error:'اكتب اسم المستخدم'});let u=data.users.find(x=>x.username.toLowerCase()===username.toLowerCase());if(!u){u={id:crypto.randomUUID(),username,balance:0,created_at:now()};data.users.push(u);save();}res.json({id:u.id,username:u.username});});
app.get('/api/me',auth,(req,res)=>res.json({id:req.user.id,username:req.user.username,balance:req.user.balance}));
app.get('/api/tasks',auth,(req,res)=>res.json(data.tasks.filter(x=>x.active)));
app.post('/api/complete-task',auth,(req,res)=>{
 const id=String(req.body.task_id||''); const t=data.tasks.find(x=>x.id===id&&x.active);
 if(!t)return res.status(404).json({error:'المهمة غير موجودة'});
 const previous=data.completions.find(x=>x.user_id===req.uid&&x.task_id===id);
 if(previous && (Date.now()-new Date(previous.completed_at).getTime())<24*60*60*1000)
   return res.status(409).json({error:'تم إكمال هذه المهمة خلال آخر 24 ساعة. عد لاحقًا.'});
 if(previous)previous.completed_at=now();else data.completions.push({user_id:req.uid,task_id:id,completed_at:now()});
 req.user.balance+=Number(t.points)||0;
 data.ledger.push({id:crypto.randomUUID(),user_id:req.uid,type:'task',task_id:id,points:Number(t.points)||0,created_at:now()});
 save(); res.json({ok:true,added:Number(t.points)||0,balance:req.user.balance});
});
app.post('/api/redeem',auth,(req,res)=>{const amount=Number(req.body.amount);if(!Number.isFinite(amount)||amount<10000)return res.status(400).json({error:'الحد الأدنى للاستبدال هو 10,000 نقطة'});if(req.user.balance<amount)return res.status(400).json({error:'رصيد النقاط غير كافٍ'});req.user.balance-=amount;const r={id:crypto.randomUUID(),user_id:req.uid,points:amount,status:'pending',created_at:now()};data.redemptions.push(r);data.ledger.push({id:crypto.randomUUID(),user_id:req.uid,type:'redeem',points:-amount,created_at:now()});save();res.json({ok:true,redemption:r,balance:req.user.balance});});
app.get('/api/history',auth,(req,res)=>res.json(data.ledger.filter(x=>x.user_id===req.uid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100)));
app.get('/health',(req,res)=>res.json({ok:true}));
app.listen(process.env.PORT||3000,()=>console.log('UC Rewards running'));
