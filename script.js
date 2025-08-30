
// Discover Firestore schema for the current user
(function(){
  const auth = firebase.auth();
  const db = firebase.firestore();
  const provider = new firebase.auth.GoogleAuthProvider();

  const $ = (id)=>document.getElementById(id);
  const outEl = $("out");
  const out = (t)=>{ outEl.textContent += t + "\n"; };

  $("login").onclick = ()=>auth.signInWithRedirect(provider);
  $("logout").onclick = ()=>auth.signOut();

  auth.onAuthStateChanged((u)=>{
    if(u){
      $("signed-out").style.display = "none";
      $("signed-in").style.display = "flex";
      $("displayName").textContent = u.displayName || "";
      $("email").textContent = u.email || "";
    }else{
      $("signed-in").style.display = "none";
      $("signed-out").style.display = "flex";
      outEl.textContent = "";
    }
  });

  $("discover").onclick = async ()=>{
    outEl.textContent = "";
    const u = auth.currentUser;
    if(!u){ out("לא מחובר"); return; }
    out("UID: " + u.uid);
    out("==== ניסיונות קריאת נתונים ====");
    try{
      // A) users/{uid}/trips
      const a = await db.collection("users").doc(u.uid).collection("trips").limit(10).get();
      out("[A] users/{uid}/trips -> " + a.size + " מסמכים");
      a.forEach(doc=>out("  - " + doc.id + " | " + Object.keys(doc.data()||{}).join(",")));
    }catch(e){ out("[A] error: " + (e.code||e.message)); }

    try{
      // B) trips where ownerUid == uid
      const b = await db.collection("trips").where("ownerUid","==", u.uid).limit(10).get();
      out("[B] trips(ownerUid==uid) -> " + b.size + " מסמכים");
      b.forEach(doc=>out("  - " + doc.id + " | " + Object.keys(doc.data()||{}).join(",")));
    }catch(e){ out("[B] error: " + (e.code||e.message)); }

    try{
      // C) כללית: 10 המסמכים הראשונים מכל קולקציית root שנקראת "trips" או "journeys"
      const roots = ["trips","journeys","travels"];
      for (const root of roots){
        try{
          const c = await db.collection(root).limit(10).get();
          out("[C] " + root + " (root) -> " + c.size + " מסמכים");
          c.forEach(doc=>out("  - " + doc.id + " | " + Object.keys(doc.data()||{}).join(",")));
        }catch(e){ out("[C] " + root + " error: " + (e.code||e.message)); }
      }
    }catch(e){ out("[C] error: " + (e.code||e.message)); }

    out("==== סוף הפלט ====");
  };
})();
