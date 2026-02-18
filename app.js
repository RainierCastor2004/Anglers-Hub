// Simple client-side auth and navigation helper (localStorage)
(function(){
  function $(id){return document.getElementById(id)}

  function getUsers(){
    try{ return JSON.parse(localStorage.getItem('users')||'[]') }catch(e){return[]}
  }
  function saveUsers(u){ localStorage.setItem('users', JSON.stringify(u)) }

  // store current user either in localStorage (remember) or sessionStorage (not remembered)
  function setCurrent(user, remember=true){
    if(remember) localStorage.setItem('currentUser', JSON.stringify(user));
    else sessionStorage.setItem('currentUser', JSON.stringify(user));
  }
  function getCurrent(){
    try{
      return JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser')) || null
    }catch(e){return null}
  }
  function clearCurrent(){ localStorage.removeItem('currentUser'); sessionStorage.removeItem('currentUser') }

  function redirectToHome(){ window.location.href='home.html' }

  // basic SHA-256 hash helper
  function buf2hex(buffer){ return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('') }
  async function hashStr(str){
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return buf2hex(buf);
  }

  // Index page (login/signup)
  document.addEventListener('DOMContentLoaded', ()=>{
    const loginForm = $('loginForm');
    const signupForm = $('signupForm');
    const showLogin = $('showLogin');
    const showSignup = $('showSignup');

    if(showLogin && showSignup){
      showLogin.addEventListener('click', ()=>{ showLogin.classList.add('active'); showSignup.classList.remove('active'); loginForm.classList.remove('hidden'); signupForm.classList.add('hidden') })
      showSignup.addEventListener('click', ()=>{ showSignup.classList.add('active'); showLogin.classList.remove('active'); signupForm.classList.remove('hidden'); loginForm.classList.add('hidden') })
    }

    if(loginForm){
      loginForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const email = $('loginEmail').value.trim();
        const pass = $('loginPassword').value;
        const remember = !!$('rememberMe') && $('rememberMe').checked;
        const passHash = await hashStr(pass);
        const user = getUsers().find(u=>u.email===email && u.passwordHash===passHash);
        if(user){ setCurrent({name:user.name,email:user.email}, remember); redirectToHome(); }
        else alert('Invalid credentials or account not found.');
      })
    }

    // ensure body has top padding equal to nav height (handles pretty URLs / Netlify and wrapping nav)
    try{
      const navEl = document.querySelector('.topnav');
      function applyNavPadding(){
        if(navEl){ document.body.style.paddingTop = navEl.offsetHeight + 'px'; }
      }
      applyNavPadding(); window.addEventListener('resize', applyNavPadding);
    }catch(e){}

    if(signupForm){
      signupForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const name = $('signupName').value.trim();
        const email = $('signupEmail').value.trim();
        const pass = $('signupPassword').value;
        const users = getUsers();
        if(users.find(u=>u.email===email)){ alert('Account already exists with that email.'); return }
        const passHash = await hashStr(pass);
          // export / import controls for syncing between devices (download JSON on PC, import on mobile)
          try{
            const syncWrap = document.createElement('div'); syncWrap.style.marginTop='10px'; syncWrap.style.display='flex'; syncWrap.style.gap='8px'; syncWrap.style.flexWrap='wrap';
            const exportBtn = document.createElement('button'); exportBtn.className='upload-btn'; exportBtn.textContent='Export Profile';
            exportBtn.addEventListener('click', ()=>{
              const u = getUserByEmail(current.email); if(!u){ alert('No profile to export'); return }
              const blob = new Blob([JSON.stringify(u, null, 2)], {type:'application/json'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = (u.email||'profile') + '-profile.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            });
            const importInput = document.createElement('input'); importInput.type='file'; importInput.accept='application/json'; importInput.style.display='none'; document.body.appendChild(importInput);
            const importBtn = document.createElement('button'); importBtn.className='upload-btn'; importBtn.textContent='Import Profile';
            importBtn.addEventListener('click', ()=> importInput.click());
            importInput.addEventListener('change', async ()=>{
              const f = importInput.files && importInput.files[0]; if(!f) return; try{
                const txt = await f.text(); const obj = JSON.parse(txt);
                if(!obj || !obj.email){ alert('Invalid profile file'); return }
                // replace or add user record
                const users = getUsers(); const idx = users.findIndex(x=>x.email===obj.email);
                if(idx>=0) users[idx] = obj; else users.push(obj);
                saveUsers(users);
                // if importing current user's email, set as current
                const cur = getCurrent(); if(cur && cur.email === obj.email){ setCurrent({name:obj.name,email:obj.email}, true); }
                updateUserInStore(obj);
                try{ renderProfile(obj.email); }catch(e){}
                try{ renderActivityFeed(); renderGallery(); }catch(e){}
                alert('Profile imported successfully.');
              }catch(err){ alert('Import failed: '+err.message); }
            });
            syncWrap.appendChild(exportBtn); syncWrap.appendChild(importBtn);
            if(controls) controls.appendChild(syncWrap);
          }catch(e){}
        users.push({name:name,email:email,passwordHash:passHash});
        saveUsers(users);
        // on signup we remember by default
        setCurrent({name:name,email:email}, true);
        redirectToHome();
      })
    }

    // Protected pages: show user info and wire logout
    const current = getCurrent();
    if(current){
      const userNameDisplay = $('userNameDisplay'); if(userNameDisplay) userNameDisplay.textContent = current.name || current.email;
      const profileName = $('profileName'); if(profileName) profileName.textContent = current.name || '';
      const profileEmail = $('profileEmail'); if(profileEmail) profileEmail.textContent = current.email || '';
    }

    // If we are on a page other than index.html, ensure logged in
    const pathname = window.location.pathname || window.location.href;
    const isIndex = pathname.endsWith('index.html') || pathname.endsWith('/');
    if(!isIndex && !getCurrent()){ window.location.href='index.html' }

    // Logout buttons
    const logoutBtn = $('logout');
    if(logoutBtn){ logoutBtn.addEventListener('click', ()=>{ clearCurrent(); window.location.href='index.html' }) }

    // register service worker for PWA install (if supported)
    try{
      if('serviceWorker' in navigator){
        navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
      }
    }catch(e){}

    /* --------------------
       Nav search (shared)
       -------------------- */
    function normalizeQuery(s){
      try{
        let t = (s||'').toString().normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
        // remove punctuation / non-alphanumeric (keep spaces), collapse whitespace
        t = t.replace(/[^0-9a-z\s]/g, ' ');
        t = t.replace(/\s+/g,' ').trim();
        return t;
      }catch(e){
        try{ return (s||'').toString().toLowerCase().replace(/[^0-9a-z\s]/g,' ').replace(/\s+/g,' ').trim(); }catch(e2){ return (s||'').toString().toLowerCase().trim(); }
      }
    }

    function searchUsers(q){
      q = normalizeQuery(q);
      if(!q) return [];
      // for debugging: emit to console so it's easier to see why nothing appears
      try{ 
        console.debug('searchUsers query:', q);
        const users = getUsers() || [];
        console.debug('searchUsers usersCount:', users.length);
          // match by username (the `name` field) OR email
          const matches = users.filter(u=>{
            const name = normalizeQuery(u.name||'');
            const email = normalizeQuery(u.email||'');
            return (name && name.includes(q)) || (email && email.includes(q));
          });
        console.debug('searchUsers matches:', matches.map(m=>({name:m.name,email:m.email}))); 
        return matches;
      }catch(e){ console.error('searchUsers error', e); return []; }
    }

    function createResultsContainer(){
      const c = document.createElement('div');
      c.className = 'search-results';
      c.style.display = 'none';
      document.body.appendChild(c);
      return c;
    }

    const resultsCache = new WeakMap();

    function showResultsFor(form, list, q){
      let container = resultsCache.get(form);
      if(!container) container = createResultsContainer(), resultsCache.set(form, container);
      container.innerHTML = '';
      try{ console.debug('showResultsFor listLength:', (list && list.length) || 0, 'query:', q); }catch(e){}
      if(!list || list.length===0){
        // show a helpful empty state so users know the search ran
        const el = document.createElement('div'); el.className='item muted';
        el.textContent = q ? ('No results for "'+q+'"') : 'No results';
        container.appendChild(el);
        const inp = form.querySelector('.search-input');
        const rect = inp.getBoundingClientRect();
        container.style.minWidth = Math.max(rect.width,220)+'px';
        container.style.left = (rect.left + window.scrollX) + 'px';
        container.style.top = (rect.bottom + window.scrollY) + 'px';
        container.style.display = 'block';
        return
      }
      list.forEach(u=>{
        const el = document.createElement('div');
        el.className = 'item';
        el.textContent = (u.name||u.email) + ' — ' + (u.email||'');
        el.addEventListener('click', ()=>{
          // navigate to profile view for that user
          window.location.href = 'profile.html?u='+encodeURIComponent(u.email);
        });
        container.appendChild(el);
      });
      // position container below the form's input
      const inp = form.querySelector('.search-input');
      const rect = inp.getBoundingClientRect();
      container.style.minWidth = Math.max(rect.width,220)+'px';
      container.style.left = (rect.left + window.scrollX) + 'px';
      container.style.top = (rect.bottom + window.scrollY) + 'px';
      container.style.display = 'block';
    }

    // wire all nav-search forms
    document.querySelectorAll('form.nav-search').forEach(form=>{
      const input = form.querySelector('.search-input');
      if(!input) return;
      // show how many users exist to help debug empty-search issues
      try{ const total = getUsers().length; input.placeholder = (input.placeholder||'Search...') + ' ('+total+' users)'; }catch(e){}
        input.setAttribute('autocomplete','off');
        input.placeholder = 'Search name or email...';
        // show suggestions when the input is focused (useful for mobile and desktop)
        input.addEventListener('focus', e=>{
          const q = (e.target.value||'').trim();
          if(!q){
            // show top users when empty
            try{
              const users = (getUsers()||[]).slice().sort((a,b)=>((a.name||'')>=(b.name||'')?1:-1)).slice(0,8);
              showResultsFor(form, users, '');
            }catch(err){ }
          } else {
            const results = searchUsers(q).slice(0,8);
            showResultsFor(form, results, q);
          }
        });
      input.addEventListener('input', e=>{
        const q = e.target.value;
        const results = searchUsers(q).slice(0,8);
        showResultsFor(form, results, q);
      });
      form.addEventListener('submit', e=>{
        e.preventDefault();
        const q = input.value.trim();
        const results = searchUsers(q);
        if(results.length===1){ window.location.href = 'profile.html?u='+encodeURIComponent(results[0].email); return }
        // otherwise show results (already shown by input), but focus container
        showResultsFor(form, results.slice(0,8), q);
      });
      // hide results when clicking outside
      document.addEventListener('click', ev=>{
        const container = resultsCache.get(form);
        if(!container) return;
        if(form.contains(ev.target) || container.contains(ev.target)) return;
        container.style.display='none';
      });
    });

    // If profile page has query param ?u=email, show that user's profile
    try{
      const params = new URLSearchParams(window.location.search);
      const viewEmail = params.get('u');
      if(viewEmail){
        const users = getUsers();
        const target = users.find(x=>x.email===viewEmail);
        if(target){
          const profileName = $('profileName'); if(profileName) profileName.textContent = target.name || '';
          const profileEmail = $('profileEmail'); if(profileEmail) profileEmail.textContent = target.email || '';
          const heading = document.querySelector('section.card h1');
          if(heading) heading.textContent = 'Profile — '+(target.name||target.email);
        }
      }
    }catch(e){/* ignore */}

    /* --------------------
       Friends, Chats, Notifications
       -------------------- */
    function ensureUserFields(user){
      if(!user) return;
      if(!Array.isArray(user.friends)) user.friends = [];
      if(!Array.isArray(user.friendRequests)) user.friendRequests = [];
      if(!Array.isArray(user.posts)) user.posts = [];
      if(typeof user.profilePic === 'undefined') user.profilePic = null;
    }

    function getUserByEmail(email){ return getUsers().find(u=>u.email===email) }
    function updateUserInStore(user){
      const users = getUsers();
      const idx = users.findIndex(u=>u.email===user.email);
      if(idx>=0) users[idx]=user; else users.push(user);
      saveUsers(users);
    }

    function addNotification(to, text, from, type='info'){
      try{
        const n = JSON.parse(localStorage.getItem('notifications')||'[]');
        n.unshift({to,toLower: (to||'').toLowerCase(),from,text,type,timestamp:Date.now(),read:false});
        localStorage.setItem('notifications', JSON.stringify(n));
      }catch(e){}
    }

    /* Activity feed (home) */
    function addActivity(act){
      try{
        const a = JSON.parse(localStorage.getItem('activities')||'[]');
        a.unshift(act);
        localStorage.setItem('activities', JSON.stringify(a));
      }catch(e){}
    }
    function getActivities(){ try{return JSON.parse(localStorage.getItem('activities')||'[]')}catch(e){return[]} }

    function getNotificationsFor(email){
      try{ return (JSON.parse(localStorage.getItem('notifications')||'[]')).filter(x=>x.to===email) }catch(e){return []}
    }

    function sendFriendRequest(fromEmail,toEmail){
      if(!fromEmail||!toEmail) return false;
      const to = getUserByEmail(toEmail); const from = getUserByEmail(fromEmail);
      if(!to||!from) return false;
      ensureUserFields(to); ensureUserFields(from);
      // avoid duplicate
      if((to.friendRequests||[]).some(r=>r.from===fromEmail)) return false;
      to.friendRequests.push({from:fromEmail,timestamp:Date.now()});
      updateUserInStore(to);
      addNotification(toEmail, `${from.name||from.email} sent you a friend request.`, fromEmail, 'friend_request');
      return true;
    }

    function acceptFriendRequest(currentEmail, fromEmail){
      const users = getUsers();
      const me = users.find(u=>u.email===currentEmail); const other = users.find(u=>u.email===fromEmail);
      if(!me||!other) return false;
      ensureUserFields(me); ensureUserFields(other);
      // remove request
      me.friendRequests = (me.friendRequests||[]).filter(r=>r.from!==fromEmail);
      // add friends both sides if not present
      if(!me.friends.includes(fromEmail)) me.friends.push(fromEmail);
      if(!other.friends.includes(currentEmail)) other.friends.push(currentEmail);
      updateUserInStore(me); updateUserInStore(other);
      addNotification(fromEmail, `${me.name||me.email} accepted your friend request.`, currentEmail, 'friend_accept');
      return true;
    }

    function cancelFriendRequest(currentEmail, toEmail){
      // cancel outgoing request by removing it from recipient's friendRequests
      const to = getUserByEmail(toEmail);
      if(!to) return false;
      to.friendRequests = (to.friendRequests||[]).filter(r=>r.from!==currentEmail);
      updateUserInStore(to);
      return true;
    }

    function areFriends(a,b){
      const ua = getUserByEmail(a); if(!ua) return false; return Array.isArray(ua.friends) && ua.friends.includes(b);
    }

    // Conversations storage
    function convStore(){ try{return JSON.parse(localStorage.getItem('conversations')||'{}')}catch(e){return {}} }
    function saveConvStore(s){ localStorage.setItem('conversations', JSON.stringify(s)) }
    function convId(a,b){ return [a,b].sort().join('::') }
    function sendMessage(from,to,text){
      const id = convId(from,to); const store = convStore(); if(!Array.isArray(store[id])) store[id]=[];
      const msg = {from,to,text,timestamp:Date.now()}; store[id].push(msg); saveConvStore(store);
      addNotification(to, `New message from ${from}`, from, 'message');
      return msg;
    }
    function getConversation(a,b){ const store = convStore(); return store[convId(a,b)] || [] }

    /* File helper */
    function fileToDataURL(file){
      return new Promise((res,rej)=>{
        const reader = new FileReader();
        reader.onload = ()=>res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }

    /* Profile picture and posts */
    function renderPosts(viewEmail){
      const list = document.getElementById('postsList'); if(!list) return;
      list.innerHTML = '';
      const user = getUserByEmail(viewEmail); if(!user) return;
      ensureUserFields(user);
      const posts = (user.posts||[]).slice().sort((a,b)=>b.timestamp-a.timestamp);
      if(posts.length===0){ list.innerHTML = '<p class="muted">No posts yet.</p>'; return }
      posts.forEach(p=>{
        const box = document.createElement('div'); box.className='post';
        if(p.img) { const img = document.createElement('img'); img.src = p.img; box.appendChild(img); }
        if(p.caption){ const c = document.createElement('div'); c.className='caption'; c.textContent = p.caption; box.appendChild(c); }
        const when = document.createElement('div'); when.className='muted'; when.style.fontSize='0.8rem'; when.textContent = new Date(p.timestamp).toLocaleString(); box.appendChild(when);
        list.appendChild(box);
      });
    }

    function renderProfile(viewEmail){
      const pic = document.getElementById('profilePic');
      const controls = document.getElementById('profileControls');
      const newPostArea = document.getElementById('newPostArea');
      const current = getCurrent();
      const user = getUserByEmail(viewEmail);
      if(!user) return;
      ensureUserFields(user);
      if(pic) pic.src = user.profilePic || ('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><rect width="100%" height="100%" fill="%23eceff6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23707b8a" font-size="18">No Photo</text></svg>');
      // show controls only when viewing own profile
      if(current && current.email === viewEmail){
        if(controls) controls.innerHTML = '';
        // profile pic upload: hidden file + styled overlay button on portrait
        try{
          const portraitDiv = document.querySelector('.profile-head .portrait');
          if(portraitDiv){
            // remove any existing overlay — we no longer show the small overlay button
            const existing = portraitDiv.querySelector('.upload-overlay'); if(existing) existing.remove();
            // intentionally do not create a portrait overlay button; use the visible "Change Profile Photo" control below
          }
          // fallback visible control (in case overlay hidden by CSS or layout)
          if(controls){
            const existingFallback = controls.querySelector('.profile-photo-fallback'); if(existingFallback) existingFallback.remove();
            const fallback = document.createElement('div'); fallback.className='profile-photo-fallback'; fallback.style.marginTop='8px';
            // remove any previously appended hidden file inputs to avoid stale elements
            document.querySelectorAll('.file-input').forEach(n=>n.remove());
            // fallback visible button; keep file input hidden and appended to body
            const fp = document.createElement('input'); fp.type='file'; fp.accept='image/*'; fp.className='file-input'; fp.style.display='none'; document.body.appendChild(fp);
            const fb = document.createElement('button'); fb.className='upload-btn'; fb.textContent = 'Change Profile Photo';
            fb.addEventListener('click', ()=> fp.click());
            fp.addEventListener('change', async ()=>{
              const f = fp.files && fp.files[0]; if(!f) return;
              const data = await fileToDataURL(f);
              const u = getUserByEmail(current.email); if(!u) return; ensureUserFields(u); u.profilePic = data; updateUserInStore(u); renderProfile(viewEmail); alert('Profile photo updated.');
              addActivity({type:'profile_pic', user:current.email, img:data, timestamp:Date.now()});
            });
            fallback.appendChild(fb);
            controls.appendChild(fallback);
          }
        }catch(e){}

        // new post area: caption + choose button + preview + post button
        if(newPostArea) newPostArea.innerHTML = '';
        const caption = document.createElement('input'); caption.type='text'; caption.placeholder='Caption (optional)'; caption.style.marginBottom='8px'; caption.style.padding='8px'; caption.style.borderRadius='8px'; caption.style.border='1px solid rgba(15,23,42,0.06)'; caption.style.width='100%';
        // remove any previously appended hidden file inputs to avoid duplicates/stale handlers
        document.querySelectorAll('.file-input').forEach(n=>n.remove());
        // hidden file input for posts appended to body to avoid mobile UA display issues
        const postFile = document.createElement('input'); postFile.type='file'; postFile.accept='image/*,video/*'; postFile.className='file-input'; postFile.style.display='none'; document.body.appendChild(postFile);
        let selectedPostData = null;
        const preview = document.createElement('div'); preview.style.margin='8px 0';
        const previewImg = document.createElement('img'); previewImg.style.maxWidth='220px'; previewImg.style.borderRadius='8px'; previewImg.style.display='none';
        const previewVid = document.createElement('video'); previewVid.style.maxWidth='320px'; previewVid.controls = true; previewVid.style.display='none';
        preview.appendChild(previewImg); preview.appendChild(previewVid);

        const chooseBtn = document.createElement('button'); chooseBtn.className='upload-btn'; chooseBtn.innerHTML = '<span class="icon"></span>Choose Photo/Video';
        chooseBtn.addEventListener('click', ()=> postFile.click());

        postFile.addEventListener('change', async ()=>{
          const f = postFile.files && postFile.files[0]; if(!f){ return }
          const data = await fileToDataURL(f);
          selectedPostData = {data, file: f};
          // show preview depending on type
          if((f.type||'').startsWith('video')){
            previewImg.style.display='none'; previewVid.style.display='block'; previewVid.src = data; previewVid.load();
          } else {
            previewVid.style.display='none'; previewImg.style.display='block'; previewImg.src = data;
          }
        });

        const submitBtn = document.createElement('button'); submitBtn.className='btn primary'; submitBtn.textContent='Post';
        submitBtn.addEventListener('click', async e=>{
          e.preventDefault();
          if(!selectedPostData){ alert('Please choose a photo or video first.'); return }
          const f = selectedPostData.file; const data = selectedPostData.data;
          const u = getUserByEmail(current.email); ensureUserFields(u);
          const mediaType = (f.type||'').startsWith('video') ? 'video' : 'image';
          u.posts.unshift({img:data,caption:caption.value||'',timestamp:Date.now(),mediaType:mediaType}); updateUserInStore(u);
          // add activity for post
          addActivity({type:'post', user:current.email, img:data, caption:caption.value||'', mediaType:mediaType, timestamp:Date.now()});
          caption.value=''; postFile.value=''; selectedPostData = null; previewImg.src=''; previewVid.src=''; previewImg.style.display='none'; previewVid.style.display='none'; renderPosts(viewEmail); renderActivityFeed(); renderGallery(); alert('Posted.');
        });

        if(newPostArea){ newPostArea.appendChild(caption); newPostArea.appendChild(chooseBtn); newPostArea.appendChild(submitBtn); newPostArea.appendChild(preview); }
      } else {
        if(controls) controls.innerHTML = '';
        if(newPostArea) newPostArea.innerHTML = '';
      }
      renderPosts(viewEmail);
    }

    // UI helpers: profile friend actions
    function renderFriendActions(viewEmail){
      const container = document.getElementById('friendActions'); if(!container) return;
      container.innerHTML = '';
      const current = getCurrent();
      if(!current) return;
      if(!viewEmail || viewEmail===current.email){ container.innerHTML = '<em>This is your profile.</em>'; return }
      const viewUser = getUserByEmail(viewEmail);
      if(!viewUser){ container.innerHTML = '<em>User not found.</em>'; return }
      // use the full stored user object for the current user (not the lightweight session object)
      const me = getUserByEmail(current.email);
      ensureUserFields(me); ensureUserFields(viewUser);
      // check states
      const hasRequestFromView = (me.friendRequests||[]).some(r=>r.from===viewEmail);
      const iSentRequest = (viewUser.friendRequests||[]).some(r=>r.from===current.email);
      const friends = areFriends(current.email, viewEmail);

      if(friends){
        const span = document.createElement('span'); span.textContent = 'You are friends'; span.className='muted'; container.appendChild(span);
        return;
      }
      if(hasRequestFromView){
        const accept = document.createElement('button'); accept.className='friend-btn primary'; accept.textContent='Accept';
        accept.addEventListener('click', ()=>{ if(acceptFriendRequest(current.email, viewEmail)){ renderFriendActions(viewEmail); alert('Friend request accepted.'); } });
        const decline = document.createElement('button'); decline.className='friend-btn'; decline.textContent='Decline';
        decline.addEventListener('click', ()=>{ cancelFriendRequest(viewEmail, current.email); renderFriendActions(viewEmail); });
        container.appendChild(accept); container.appendChild(decline); return;
      }
      if(iSentRequest){
        const cancel = document.createElement('button'); cancel.className='friend-btn'; cancel.textContent='Cancel Request';
        cancel.addEventListener('click', ()=>{ cancelFriendRequest(current.email, viewEmail); renderFriendActions(viewEmail); });
        container.appendChild(cancel); return;
      }
      const btn = document.createElement('button'); btn.className='friend-btn primary'; btn.textContent='Add Friend';
      btn.addEventListener('click', ()=>{ if(sendFriendRequest(current.email, viewEmail)){ renderFriendActions(viewEmail); alert('Friend request sent.'); } });
      container.appendChild(btn);
    }

    // Chat page wiring
    function renderFriendsList(){
      const list = document.getElementById('friendsList'); if(!list) return;
      list.innerHTML = '';
      const current = getCurrent(); if(!current) return;
      const me = getUserByEmail(current.email); ensureUserFields(me);
      const friends = me.friends || [];
      if(friends.length===0){ list.innerHTML = '<p class="muted">No friends yet. Add friends to chat.</p>'; return }
      friends.forEach(email=>{
        const u = getUserByEmail(email); ensureUserFields(u);
        const el = document.createElement('div'); el.className='friend';
        const avatar = document.createElement('img'); avatar.className='avatar';
        avatar.src = (u && u.profilePic) ? u.profilePic : ('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="100%" height="100%" fill="%23eceff6"/></svg>');
        const name = document.createElement('div'); name.className='name'; name.textContent = (u&&u.name)?u.name:email;
        el.appendChild(avatar); el.appendChild(name);
        el.addEventListener('click', ()=>openChatWith(email));
        list.appendChild(el);
      });
    }

    let activeChat = null;
    function openChatWith(email){
      const header = document.getElementById('chatHeader'); const msgs = document.getElementById('messagesList');
      const current = getCurrent(); if(!current) return;
      const other = getUserByEmail(email); ensureUserFields(other);
      // show avatar + username in header
      if(header){
        const img = document.createElement('img'); img.src = (other && other.profilePic) ? other.profilePic : ('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="100%" height="100%" fill="%23eceff6"/></svg>');
        img.style.width='36px'; img.style.height='36px'; img.style.borderRadius='50%'; img.style.objectFit='cover'; img.style.marginRight='8px';
        header.innerHTML = '';
        const headerWrap = document.createElement('div'); headerWrap.style.display='flex'; headerWrap.style.alignItems='center';
        const title = document.createElement('div'); title.textContent = (other && other.name) ? other.name : email; title.style.fontWeight='700';
        headerWrap.appendChild(img); headerWrap.appendChild(title); header.appendChild(headerWrap);
      }
      activeChat = email;
      renderMessages();
    }

    function renderMessages(){
      const msgs = document.getElementById('messagesList'); if(!msgs) return;
      const current = getCurrent(); if(!current || !activeChat){ msgs.innerHTML=''; return }
      const conv = getConversation(current.email, activeChat);
      msgs.innerHTML = '';
      conv.forEach(m=>{
        const el = document.createElement('div'); el.className='msg '+(m.from===current.email? 'me':'other');
        el.textContent = m.text;
        msgs.appendChild(el);
      });
      msgs.scrollTop = msgs.scrollHeight;
    }

    const messageForm = document.getElementById('messageForm');
    if(messageForm){
      messageForm.addEventListener('submit', e=>{
        e.preventDefault(); const input = document.getElementById('messageInput'); if(!input) return; const text = input.value.trim(); if(!text||!activeChat) return; const current = getCurrent(); sendMessage(current.email, activeChat, text); input.value=''; renderMessages();
      });
    }

    // Notifications page wiring
    function renderNotifications(){
      const list = document.getElementById('notificationsList'); if(!list) return;
      const current = getCurrent(); if(!current){ list.innerHTML='<li class="muted">Log in to see notifications.</li>'; return }
      const nots = getNotificationsFor(current.email) || [];
      if(nots.length===0){ list.innerHTML='<li class="muted">No notifications.</li>'; return }
      list.innerHTML = '';
      nots.forEach(n=>{
        const li = document.createElement('li'); li.className = (n.read? '':'unread');
        const when = new Date(n.timestamp).toLocaleString();
        // friend request notifications get action buttons
        if(n.type==='friend_request' && n.from){
          const txt = document.createElement('div'); txt.textContent = `${n.text} · ${when}`;
          const actions = document.createElement('div'); actions.style.marginTop='8px';
          const alreadyFriends = areFriends(current.email, n.from);
          if(alreadyFriends){
            const acceptedBtn = document.createElement('button'); acceptedBtn.className='friend-btn primary'; acceptedBtn.textContent='Accepted'; acceptedBtn.disabled = true;
            actions.appendChild(acceptedBtn);
          } else {
            const acceptBtn = document.createElement('button'); acceptBtn.className='friend-btn primary'; acceptBtn.textContent='Accept';
            acceptBtn.addEventListener('click', ()=>{
              // accept the friend request
              if(acceptFriendRequest(current.email, n.from)){
                // mark notification read
                const all = JSON.parse(localStorage.getItem('notifications')||'[]');
                const idx = all.findIndex(x=>x.timestamp===n.timestamp && x.to===n.to && x.from===n.from);
                if(idx>=0){ all[idx].read=true; localStorage.setItem('notifications', JSON.stringify(all)); }
                renderNotifications();
                try{ renderFriendsList(); }catch(e){}
                try{ const params = new URLSearchParams(window.location.search); const v = params.get('u'); if(v) renderFriendActions(v); }catch(e){}
                alert('Friend request accepted — you are now connected.');
              }
            });
            const declineBtn = document.createElement('button'); declineBtn.className='friend-btn'; declineBtn.textContent='Decline';
            declineBtn.addEventListener('click', ()=>{
              // remove the incoming request
              cancelFriendRequest(n.from, current.email);
              const all = JSON.parse(localStorage.getItem('notifications')||'[]');
              const idx = all.findIndex(x=>x.timestamp===n.timestamp && x.to===n.to && x.from===n.from);
              if(idx>=0) { all.splice(idx,1); localStorage.setItem('notifications', JSON.stringify(all)); }
              renderNotifications();
              try{ renderFriendsList(); }catch(e){}
              try{ const params = new URLSearchParams(window.location.search); const v = params.get('u'); if(v) renderFriendActions(v); }catch(e){}
            });
            actions.appendChild(acceptBtn); actions.appendChild(declineBtn);
          }
          li.appendChild(txt); li.appendChild(actions);
        } else {
          li.textContent = `${n.text} · ${when}`;
          li.addEventListener('click', ()=>{ n.read = true; const all = JSON.parse(localStorage.getItem('notifications')||'[]'); const idx = all.findIndex(x=>x.timestamp===n.timestamp && x.to===n.to && x.text===n.text); if(idx>=0){ all[idx].read=true; localStorage.setItem('notifications', JSON.stringify(all)); } renderNotifications(); });
        }
        list.appendChild(li);
      });
    }

    const clearBtn = document.getElementById('clearNotifications'); if(clearBtn){ clearBtn.addEventListener('click', ()=>{ const current = getCurrent(); if(!current) return; const all = JSON.parse(localStorage.getItem('notifications')||'[]'); const remaining = all.filter(x=>x.to!==current.email); localStorage.setItem('notifications', JSON.stringify(remaining)); renderNotifications(); }); }

    // run initial renders if on those pages
    try{
      // Render profile when profile elements exist (works with pretty URLs like /profile)
      if(document.getElementById('profilePic') || document.getElementById('postsList') || document.getElementById('friendActions')){
        const params = new URLSearchParams(window.location.search);
        const v = params.get('u') || (getCurrent() && getCurrent().email);
        renderFriendActions(v);
        renderProfile(v);
      }
    }catch(e){}
    try{
      if(document.getElementById('friendsList')){ renderFriendsList(); }
    }catch(e){}
    try{ if(document.getElementById('usersList')){ renderUsersList(); } }catch(e){}
    try{
      const btn = document.getElementById('showRawUsers'); if(btn) btn.addEventListener('click', showRawUsersOverlay);
      const close = document.getElementById('closeRawUsers'); if(close) close.addEventListener('click', hideRawUsersOverlay);
      const seedBtn = document.getElementById('seedDemoUsers'); if(seedBtn) seedBtn.addEventListener('click', ()=>{ seedDemoUsers(); });
    }catch(e){}
    try{
      if(document.getElementById('notificationsList')){ renderNotifications(); }
    }catch(e){}

    // Home activity feed
    function renderActivityFeed(){
      const feed = document.getElementById('activityFeed'); if(!feed) return;
      const acts = getActivities().slice(0,50);
      if(acts.length===0){ feed.innerHTML = '<p class="muted">No recent activity.</p>'; return }
      feed.innerHTML = '';
      acts.forEach(a=>{
        const box = document.createElement('div'); box.className='activity';
        const thumb = document.createElement('div');
        if(a.img){ const im = document.createElement('img'); im.src = a.img; thumb.appendChild(im); } else { const im = document.createElement('div'); im.style.width='84px'; im.style.height='84px'; im.style.background='rgba(0,0,0,0.05)'; thumb.appendChild(im); }
        const meta = document.createElement('div'); meta.className='meta';
        const who = getUserByEmail(a.user);
        const title = document.createElement('div'); title.innerHTML = `<strong>${(who && who.name) ? who.name : a.user}</strong> ` + (a.type==='profile_pic' ? 'changed profile photo' : (a.type==='post' ? (a.mediaType==='video' ? 'posted a video' : 'posted a photo') : a.type));
        const when = document.createElement('div'); when.className='muted'; when.style.fontSize='0.85rem'; when.textContent = new Date(a.timestamp).toLocaleString();
        meta.appendChild(title);
        if(a.caption) { const c = document.createElement('div'); c.className='caption'; c.textContent = a.caption; meta.appendChild(c); }
        meta.appendChild(when);
        box.appendChild(thumb); box.appendChild(meta); feed.appendChild(box);
      });
    }

    // Gallery page render
    function renderGallery(){
      const grid = document.getElementById('galleryGrid'); if(!grid) return;
      grid.innerHTML = '';
      const users = getUsers();
      const tiles = [];
      users.forEach(u=>{
        ensureUserFields(u);
        const userName = u.name || u.email;
        (u.posts||[]).forEach(p=>{
          if(p.img && (!p.mediaType || p.mediaType==='image')) tiles.push({img:p.img, userEmail:u.email, userName:userName, caption:p.caption});
        });
      });
      if(tiles.length===0){ grid.innerHTML = '<p class="muted">No photos yet.</p>'; return }
      tiles.forEach(t=>{
        const tile = document.createElement('div'); tile.className='tile';
        const img = document.createElement('img'); img.src = t.img; tile.appendChild(img);
        const cap = document.createElement('div'); cap.className='muted'; cap.style.fontSize='0.85rem';
        cap.textContent = `${t.userName}${t.caption? ' - '+t.caption:''}`;
        tile.appendChild(cap); grid.appendChild(tile);
      });
    }

    // People page render (list all users)
    function renderUsersList(){
      const list = document.getElementById('usersList'); if(!list) return;
      const users = getUsers() || [];
      if(users.length===0){ list.innerHTML = '<p class="muted">No users yet.</p>'; return }
      list.innerHTML = '';
      users.forEach(u=>{
        ensureUserFields(u);
        const card = document.createElement('div'); card.style.display='flex'; card.style.alignItems='center'; card.style.justifyContent='space-between'; card.style.padding='12px'; card.style.borderRadius='8px'; card.style.border='1px solid rgba(15,23,42,0.04)';
        const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='12px';
        const av = document.createElement('img'); av.src = u.profilePic || ('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="100%" height="100%" fill="%23eceff6"/></svg>'); av.style.width='56px'; av.style.height='56px'; av.style.borderRadius='8px'; av.style.objectFit='cover';
        const meta = document.createElement('div');
        const name = document.createElement('div'); name.style.fontWeight='700'; name.textContent = u.name || u.email;
        const em = document.createElement('div'); em.className='muted'; em.textContent = u.email;
        meta.appendChild(name); meta.appendChild(em);
        left.appendChild(av); left.appendChild(meta);
        const actions = document.createElement('div');
        const view = document.createElement('a'); view.href = 'profile.html?u='+encodeURIComponent(u.email); view.className='btn small'; view.textContent='View';
        actions.appendChild(view);
        card.appendChild(left); card.appendChild(actions);
        list.appendChild(card);
      });
    }

    // Debug: show raw users JSON overlay (for diagnosing missing search results)
    function showRawUsersOverlay(){
      const overlay = document.getElementById('rawUsersOverlay'); const pre = document.getElementById('rawUsersPre');
      if(!overlay || !pre) return;
      const users = getUsers() || [];
      // mark entries with missing name
      const decorated = users.map(u=>{
        const hasName = (u.name||'').toString().trim().length>0;
        return Object.assign({}, u, {__missingName: !hasName});
      });
      pre.textContent = JSON.stringify(decorated, null, 2);
      overlay.style.display = 'block';
    }
    function hideRawUsersOverlay(){ const overlay = document.getElementById('rawUsersOverlay'); if(overlay) overlay.style.display='none'; }

    // seed demo users (useful if localStorage is empty or on first run)
    async function seedDemoUsers(){
      try{
        const exists = getUsers(); if(exists && exists.length>0){ alert('Users already exist — seeding skipped.'); return }
        const pw = 'password';
        const h = await hashStr(pw);
        const samples = [
          {name:'Juan Dela Cruz', email:'juan@example.com', passwordHash:h, friends:[],friendRequests:[],posts:[]},
          {name:'Maria Santos', email:'maria@example.com', passwordHash:h, friends:[],friendRequests:[],posts:[]},
          {name:'Pedro Reyes', email:'pedro@example.com', passwordHash:h, friends:[],friendRequests:[],posts:[]}
        ];
        saveUsers(samples);
        alert('Seeded '+samples.length+' demo users. You can log in with password "password" for each.');
        try{ renderUsersList(); }catch(e){}
      }catch(e){ alert('Seeding failed: '+(e && e.message)); }
    }

    // Achievements: species list and unlocked detection
    const SPECIES = [
      {key:'lapu-lapu', label:'Lapu-lapu (Grouper)', emoji:'🐟'},
      {key:'maya-maya', label:'Maya-maya (Snapper)', emoji:'🐠'},
      {key:'tuna', label:'Tuna (Yellowfin)', emoji:'🐟'},
      {key:'mahi-mahi', label:'Mahi-mahi (Dorado)', emoji:'🐬'},
      {key:'bangus', label:'Bangus (Milkfish)', emoji:'🐟'},
      {key:'tilapia', label:'Tilapia', emoji:'🐟'},
      {key:'marlin', label:'Marlin', emoji:'🎣'},
      {key:'sailfish', label:'Sailfish', emoji:'🎣'},
      {key:'barracuda', label:'Barracuda', emoji:'🐡'},
      {key:'trevally', label:'Trevally (GT)', emoji:'🐟'},
      {key:'catfish', label:'Catfish', emoji:'🐟'},
      {key:'snapper', label:'Red Snapper', emoji:'🐠'}
    ];

    function renderAchievements(){
      const grid = document.getElementById('speciesGrid'); if(!grid) return;
      grid.innerHTML = '';
      const current = getCurrent(); if(!current){ grid.innerHTML = '<p class="muted">Log in to see unlocked species.</p>'; return }
      const user = getUserByEmail(current.email); ensureUserFields(user);
      SPECIES.forEach(s=>{
        // unlocked when a post caption contains: UNLOCKED (Fish Species)
        let unlocked = false;
        (user.posts||[]).forEach(p=>{
          const cap = (p.caption||'').toString();
          const m = cap.match(/UNLOCKED\s*\(\s*([^\)]+)\s*\)/i);
          if(m){
            const fishName = m[1].trim().toLowerCase();
            if(fishName.includes(s.key) || s.label.toLowerCase().includes(fishName) || fishName.includes(s.label.toLowerCase().split(' ')[0])) unlocked = true;
          }
        });
        const el = document.createElement('div'); el.className = 'species' + (unlocked? '':' locked');
        const icon = document.createElement('div'); icon.className='icon';
        const im = document.createElement('img');
        // prefer PNG if present, otherwise fallback to SVG
        im.src = 'images/species/'+s.key+'.png';
        im.alt = s.label;
        im.onerror = function(){ this.onerror = null; this.src = 'images/species/'+s.key+'.svg'; };
        icon.appendChild(im);
        const label = document.createElement('div'); label.textContent = s.label; label.style.fontWeight='600'; label.style.textAlign='center';
        const status = document.createElement('div'); status.className='muted'; status.style.fontSize='0.85rem'; status.textContent = unlocked? 'Unlocked':'Locked';
        el.appendChild(icon); el.appendChild(label); el.appendChild(status); grid.appendChild(el);
      });
    }

    // run pages renders — detect by presence of page elements so pretty URLs work (Netlify, etc.)
    try{ if(document.getElementById('activityFeed')) renderActivityFeed(); }catch(e){}
    try{ if(document.getElementById('galleryGrid')) renderGallery(); }catch(e){}
    try{ if(document.getElementById('speciesGrid')) renderAchievements(); }catch(e){}
  })
})();
