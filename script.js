
(function () {
  const authBtn = document.getElementById('authBtn');
  const hint = document.getElementById('hint');
  const tripsEl = document.getElementById('trips');

  function setAuthBtn(user){
    if(user){
      authBtn.textContent = 'התנתק';
      authBtn.onclick = () => auth.signOut();
    }else{
      authBtn.textContent = 'התחבר';
      authBtn.onclick = signIn;
    }
  }

  async function signIn(){
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      // Try popup, fallback to redirect on mobile/Safari
      try{
        await auth.signInWithPopup(provider);
      }catch(e){
        await auth.signInWithRedirect(provider);
      }
    }catch(err){
      alert('נכשל להתחבר: ' + err.message);
      console.error(err);
    }
  }

  function renderTrips(list){
    tripsEl.innerHTML = '';
    for(const t of list){
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('h3');
      title.textContent = t.title || 'טיול ללא שם';
      const days = document.createElement('div');
      const range = (t.start && t.end) ? `${t.start}–${t.end}` : '';
      days.textContent = [range, t.days ? `ימים ${t.days}` : ''].filter(Boolean).join(' • ');

      const badges = document.createElement('div');
      badges.className = 'badges';
      (t.tags || []).slice(0,4).forEach(tag=>{
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = tag;
        badges.appendChild(b);
      });

      card.appendChild(title);
      card.appendChild(days);
      card.appendChild(badges);
      tripsEl.appendChild(card);
    }
  }

  async function loadTrips(uid){
    try{
      // Defensive: if collection/security rules not ready, fail silently
      const snap = await db.collection('trips')
        .where('uid', '==', uid)
        .orderBy('updatedAt','desc')
        .limit(50)
        .get()
        .catch((e)=>{
          console.warn('Cannot query trips (ignored):', e.message);
          return null;
        });

      const items = [];
      if(snap){
        snap.forEach(doc => items.push({id: doc.id, ...doc.data()}));
      }

      if(items.length === 0){
        hint.textContent = 'לא נמצאו טיולים עבור המשתמש.';
        hint.hidden = false;
        tripsEl.hidden = true;
      }else{
        hint.hidden = true;
        tripsEl.hidden = false;
        renderTrips(items);
      }
    }catch(err){
      console.error(err);
      hint.textContent = 'שגיאה בטעינת טיולים.';
      hint.hidden = false;
      tripsEl.hidden = true;
    }
  }

  auth.onAuthStateChanged(async (user) => {
    setAuthBtn(user);
    if(!user){
      hint.textContent = 'יש להתחבר כדי לראות טיולים';
      hint.hidden = false;
      tripsEl.hidden = true;
      tripsEl.innerHTML = '';
    }else{
      await loadTrips(user.uid);
    }
  });
})();
