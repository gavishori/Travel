(function(){
  const auth=firebase.auth(); const db=firebase.firestore();
  const provider=new firebase.auth.GoogleAuthProvider();
  const $=id=>document.getElementById(id);
  const log=m=>{$("logs").textContent+=m+"\n"}; const status=m=>$("status").textContent=m||"";

  $("login").onclick=()=>auth.signInWithRedirect(provider);
  $("logout").onclick=()=>auth.signOut();
  $("debug").onclick=()=>alert(JSON.stringify({uid:auth.currentUser?.uid,email:auth.currentUser?.email,ua:navigator.userAgent},null,2));

  auth.getRedirectResult().then(res=>log("getRedirectResult:"+(res.user?"ok":"no user"))).catch(e=>log("redirect error:"+e.message));

  function renderTrips(snap,label){let html="";snap.forEach(d=>{let t=d.data();html+=`<div class='trip'><b>${t.name||"ללא שם"}</b><br>${t.days||"?"} ימים</div>`}); if(html){$("trips").innerHTML=html;status("מקור:"+label);return true} return false}

  async function loadTrips(uid){status("טוען...");$("trips").innerHTML="";
    try{let snapA=await db.collection("users").doc(uid).collection("trips").get(); if(renderTrips(snapA,"users/{uid}/trips"))return;}catch(e){log("A:"+e.message)}
    try{let snapB=await db.collection("trips").where("ownerUid","==",uid).get(); if(renderTrips(snapB,"trips(ownerUid)"))return;}catch(e){log("B:"+e.message)}
    status("לא נמצאו נסיעות");}

  auth.onAuthStateChanged(u=>{log("onAuthStateChanged:"+(u?"in":"out")); if(u){$("signed-out").style.display="none";$("signed-in").style.display="block";$("displayName").textContent=u.displayName;$("email").textContent=u.email;loadTrips(u.uid)}else{$("signed-in").style.display="none";$("signed-out").style.display="block"}});
})();