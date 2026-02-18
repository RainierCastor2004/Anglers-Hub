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

    if(signupForm){
      signupForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const name = $('signupName').value.trim();
        const email = $('signupEmail').value.trim();
        const pass = $('signupPassword').value;
        const users = getUsers();
        if(users.find(u=>u.email===email)){ alert('Account already exists with that email.'); return }
        const passHash = await hashStr(pass);
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

    /* --------------------
       Nav search (shared)
       -------------------- */
    function searchUsers(q){
      if(!q) return [];
      q = q.toLowerCase().trim();
      return getUsers().filter(u=>((u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)));
    }

    function createResultsContainer(){
      const c = document.createElement('div');
      c.className = 'search-results';
      c.style.display = 'none';
      document.body.appendChild(c);
      return c;
    }

    const resultsCache = new WeakMap();

    function showResultsFor(form, list){
      let container = resultsCache.get(form);
      if(!container) container = createResultsContainer(), resultsCache.set(form, container);
      container.innerHTML = '';
      if(!list || list.length===0){ container.style.display='none'; return }
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
      input.setAttribute('autocomplete','off');
      input.addEventListener('input', e=>{
        const q = e.target.value;
        const results = searchUsers(q).slice(0,8);
        showResultsFor(form, results);
      });
      form.addEventListener('submit', e=>{
        e.preventDefault();
        const q = input.value.trim();
        const results = searchUsers(q);
        if(results.length===1){ window.location.href = 'profile.html?u='+encodeURIComponent(results[0].email); return }
        // otherwise show results (already shown by input), but focus container
        showResultsFor(form, results.slice(0,8));
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
            // remove existing overlay if any
            const existing = portraitDiv.querySelector('.upload-overlay'); if(existing) existing.remove();
            const fileProfile = document.createElement('input'); fileProfile.type='file'; fileProfile.accept='image/*'; fileProfile.className='file-input';
            const overlay = document.createElement('div'); overlay.className='upload-overlay';
            const overlayBtn = document.createElement('button'); overlayBtn.className='upload-btn'; overlayBtn.innerHTML = '<span class="icon"></span>Change';
            overlayBtn.addEventListener('click', ()=> fileProfile.click());
            fileProfile.addEventListener('change', async ()=>{
              const f = fileProfile.files && fileProfile.files[0]; if(!f) return;
              const data = await fileToDataURL(f);
              const u = getUserByEmail(current.email); if(!u) return; ensureUserFields(u); u.profilePic = data; updateUserInStore(u); renderProfile(viewEmail); alert('Profile photo updated.');
            });
            overlay.appendChild(fileProfile); overlay.appendChild(overlayBtn);
            portraitDiv.appendChild(overlay);
          }
        }catch(e){}

        // new post area: caption + single choose&post button
        if(newPostArea) newPostArea.innerHTML = '';
        const caption = document.createElement('input'); caption.type='text'; caption.placeholder='Caption (optional)'; caption.style.marginBottom='8px'; caption.style.padding='8px'; caption.style.borderRadius='8px'; caption.style.border='1px solid rgba(15,23,42,0.06)'; caption.style.width='100%';
        const postFile = document.createElement('input'); postFile.type='file'; postFile.accept='image/*'; postFile.className='file-input';
        const postBtn = document.createElement('button'); postBtn.className='upload-btn primary'; postBtn.innerHTML = '<span class="icon"></span>Choose & Post Photo';
        postBtn.addEventListener('click', ()=> postFile.click());
        postFile.addEventListener('change', async ()=>{
          const f = postFile.files && postFile.files[0]; if(!f){ return }
          const data = await fileToDataURL(f);
          const u = getUserByEmail(current.email); ensureUserFields(u);
          u.posts.unshift({img:data,caption:caption.value||'',timestamp:Date.now()}); updateUserInStore(u); caption.value=''; postFile.value=''; renderPosts(viewEmail); alert('Posted.');
        });
        if(newPostArea){ newPostArea.appendChild(caption); newPostArea.appendChild(postFile); newPostArea.appendChild(postBtn); }
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
      ensureUserFields(viewUser);
      // check states
      const hasRequestFromView = (current.friendRequests||[]).some(r=>r.from===viewEmail);
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
        const u = getUserByEmail(email);
        const el = document.createElement('div'); el.className='friend'; el.textContent = (u&&u.name)?u.name+' — '+email:email;
        el.addEventListener('click', ()=>openChatWith(email));
        list.appendChild(el);
      });
    }

    let activeChat = null;
    function openChatWith(email){
      const header = document.getElementById('chatHeader'); const msgs = document.getElementById('messagesList');
      const current = getCurrent(); if(!current) return;
      const other = getUserByEmail(email);
      header.textContent = (other && other.name) ? other.name + ' — ' + email : email;
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
      const p = window.location.pathname;
      if(p.endsWith('profile.html')){
        const params = new URLSearchParams(window.location.search);
        const v = params.get('u') || (getCurrent() && getCurrent().email);
        renderFriendActions(v);
        renderProfile(v);
      }
    }catch(e){}
    try{ if(window.location.pathname.endsWith('chats.html')){ renderFriendsList(); }
    }catch(e){}
    try{ if(window.location.pathname.endsWith('notifications.html')){ renderNotifications(); }
    }catch(e){}
  })
})();
