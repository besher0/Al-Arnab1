const base='http://localhost:3000/api';
async function req(path,{method='GET',token,body}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});let d=null;try{d=await r.json();}catch{};return {ok:r.ok,status:r.status,data:d};}
(async()=>{
  const adminLogin=await req('/auth/login',{method:'POST',body:{phone:'0500000000'}});
  if(!adminLogin.ok){console.log('ADMIN_LOGIN_FAIL',adminLogin.status,adminLogin.data);return;}
  const adminToken=adminLogin.data.accessToken;

  const userPhone='+9639'+Math.floor(10000000+Math.random()*89999999);
  const userReg=await req('/auth/register',{method:'POST',body:{name:'Flow User',phone:userPhone}});
  const userToken=userReg.data?.accessToken;
  const productsBoot=await req('/catalog/bootstrap');
  const products=(productsBoot.data&&productsBoot.data.products)||[];
  const product=products.find(p=>Number(p.stockQty)>0);
  if(!product){console.log('NO_STOCK_PRODUCT');return;}

  await req('/cart/items',{method:'POST',token:userToken,body:{productId:product.id,qty:1}});
  const checkout=await req('/cart/checkout',{method:'POST',token:userToken,body:{alternatePhone:'0999999999',latitude:33.5,longitude:36.3}});
  if(!checkout.ok){console.log('CHECKOUT_FAIL',checkout.status,checkout.data);return;}
  const orderId=checkout.data.order.id;

  async function upd(status,extra){
    const r=await req('/admin/orders/'+encodeURIComponent(orderId)+'/status',{method:'PATCH',token:adminToken,body:{status,...(extra||{})}});
    console.log('UPDATE',status,r.status,r.data&&r.data.message?r.data.message:(r.data&&r.data.status?r.data.status:'-'));
  }

  await upd('ON_THE_WAY');
  await upd('PREPARING',{prepMinutes:20,note:'prep'});
  await upd('DELIVERED');
  await upd('ON_THE_WAY',{note:'delivery'});
  await upd('DELIVERED',{note:'done'});

  const boot=await req('/catalog/bootstrap');
  console.log('STORE_BOOT',boot.status,boot.data&&boot.data.store);
})();
