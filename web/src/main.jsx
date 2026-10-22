import React, {useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import {parseStoryGraphCSV} from './storygraph'
import {readingStatistics} from './readingStatistics'
import {challengeVariant,challengeYears,eligibleChallengeBooks,eligibleChallengeBooksForMonth} from './challengeRules'
import {achievements,monthlyQuests} from './gamification'
import {findPublicationCandidates} from './publicationLookup'
import {decodeVapidKey,serializePushSubscription} from './pushSubscription'
import './style.css'

const tabs=['Home','Library','Series','Journal','Challenges','Statistics']
const accent={Home:'#8364AC',Library:'#695080',Series:'#6E739F',Journal:'#B76C9D',Challenges:'#417CA5',Statistics:'#315C87'}
const formats=[['','Not selected'],['paperback','Paperback'],['hardcover','Hardcover'],['ebook','E-book'],['audiobook','Audiobook']]
const statuses=[['to_read','To Read'],['reading','Currently Reading'],['finished','Finished'],['dnf','DNF']]
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function ReleaseReminder({books,userId,onSave}){
 const [enabled,setEnabled]=useState(false)
 const [notice,setNotice]=useState('')
 const [editing,setEditing]=useState('')
 const [date,setDate]=useState('')
 const [subscribed,setSubscribed]=useState(true)
 const [dayTick,setDayTick]=useState(0)
 const [candidates,setCandidates]=useState([])
 const [lookingUp,setLookingUp]=useState(false)
 const [workerReady,setWorkerReady]=useState(false)
 const [installHint,setInstallHint]=useState(false)
 const [pushStatus,setPushStatus]=useState('')
 const [pushBusy,setPushBusy]=useState(false)
 const [deviceRegistered,setDeviceRegistered]=useState(false)
 const vapidKey=import.meta.env.VITE_VAPID_PUBLIC_KEY||''
 useEffect(()=>{
  let cancelled=false
  if(!userId||!('serviceWorker' in navigator)||!('PushManager' in window))return
  ;(async()=>{
   try{
    const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    if(!registration){if(!cancelled)setDeviceRegistered(false);return}
    const subscription=await registration.pushManager.getSubscription()
    if(!subscription){if(!cancelled)setDeviceRegistered(false);return}
    const {data,error}=await supabase.from('rc_push_subscriptions').select('id').eq('user_id',userId).eq('endpoint',subscription.endpoint).limit(1)
    if(!cancelled&&!error)setDeviceRegistered(!!data?.length)
   }catch{if(!cancelled)setDeviceRegistered(false)}
  })()
  return()=>{cancelled=true}
 },[userId,workerReady])
 useEffect(()=>{if(!('serviceWorker' in navigator))return;const scope=import.meta.env.BASE_URL;navigator.serviceWorker.register(scope+'sw.js',{scope}).then(()=>setWorkerReady(true)).catch(()=>setWorkerReady(false));setInstallHint(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches)},[])
 useEffect(()=>{const timer=window.setInterval(()=>setDayTick(v=>v+1),60000);return()=>window.clearInterval(timer)},[])
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 const tracked=books.filter(b=>b.release_alert_enabled&&b.release_on&&b.status==='to_read').sort((a,b)=>a.release_on.localeCompare(b.release_on))
 const upcoming=tracked.filter(b=>b.release_on>=today())
 useEffect(()=>{setEnabled(typeof Notification!=='undefined'&&Notification.permission==='granted')},[])
 useEffect(()=>{
  if(!userId||!enabled||!subscribed||typeof Notification==='undefined'||Notification.permission!=='granted')return
  const todayLocal=today()
  const due=tracked.filter(b=>b.release_on===todayLocal)
  ;(async()=>{for(const b of due){
   const key='rc-release-alert:'+userId+':'+b.id+':'+todayLocal
   try{
    if(localStorage.getItem(key))continue
    const registration=await navigator.serviceWorker?.ready
    if(registration?.showNotification){await registration.showNotification('Book release today',{body:b.title+(b.author?' — '+b.author:''),tag:key,icon:import.meta.env.BASE_URL+'icon.svg'})}
    else new Notification('Book release today',{body:b.title+(b.author?' — '+b.author:''),tag:key})
    localStorage.setItem(key,'shown')
   }catch(err){setNotice('This browser cannot display a notification: '+(err.message||'unknown error'));break}
  }})()
 },[books,userId,enabled,subscribed,dayTick])
 async function enable(){
  if(typeof Notification==='undefined'){setNotice('This browser does not support notifications.');return}
  if(!window.isSecureContext){setNotice('Notifications require HTTPS.');return}
  try{const result=await Notification.requestPermission();setEnabled(result==='granted');setNotice(result==='granted'?'Notifications enabled while the app is open. Background push is not configured.':'Notification permission was not granted.')}catch(err){setNotice(err.message||'Unable to request permission.')}
 }
 async function testLocalNotification(){
  if(!('serviceWorker' in navigator)||typeof Notification==='undefined'){setPushStatus('Notifications are not supported in this browser.');return}
  if(!window.isSecureContext){setPushStatus('Notifications require HTTPS.');return}
  setPushBusy(true)
  try{
   const permission=await Notification.requestPermission()
   setEnabled(permission==='granted')
   if(permission!=='granted'){setPushStatus('Notification permission was not granted.');return}
   const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
   if(!registration||!registration.showNotification){setPushStatus('Install Reading Companion on your iPhone Home Screen and open it there to test notifications.');return}
   await registration.showNotification('Reading Companion test',{body:'Notifications are working on this device while the app is open.',tag:'rc-local-test',icon:import.meta.env.BASE_URL+'icon.svg',data:{url:import.meta.env.BASE_URL}})
   setPushStatus('Local test notification requested. This does not test background delivery from the server.')
  }catch(err){setPushStatus('Local test failed: '+(err.message||'unknown error'))}
  finally{setPushBusy(false)}
 }
 async function subscribePush(){
  if(!vapidKey){setPushStatus('Background push is not configured: missing public VAPID key.');return}
  if(!('serviceWorker' in navigator)||!('PushManager' in window)){setPushStatus('This browser does not support Web Push.');return}
  setPushBusy(true)
  try{
   const permission=await Notification.requestPermission()
   setEnabled(permission==='granted')
   if(permission!=='granted'){setPushStatus('Notification permission denied.');return}
   const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
   if(!registration)throw new Error('Service worker is not ready; reload the app and retry.')
   let subscription=await registration.pushManager.getSubscription()
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(vapidKey)})
   const payload=serializePushSubscription(subscription,userId)
   const {error}=await supabase.from('rc_push_subscriptions').upsert(payload,{onConflict:'user_id,endpoint'})
   if(error)throw error
   setDeviceRegistered(true)
   setPushStatus('This device is registered. Delivery depends on the server configuration and a verified test.')
  }catch(err){setPushStatus('Could not register this device: '+(err.message||'unknown error'))}
  finally{setPushBusy(false)}
 }
 async function unsubscribePush(){
  setPushBusy(true)
  try{
   const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
   if(!registration)throw new Error('Service worker is not registered on this device.')
   const subscription=await registration.pushManager.getSubscription()
   if(!subscription){setDeviceRegistered(false);setPushStatus('No push subscription on this device.');return}
   const endpoint=subscription.endpoint
   const {error}=await supabase.from('rc_push_subscriptions').delete().eq('user_id',userId).eq('endpoint',endpoint)
   if(error)throw error
   const removed=await subscription.unsubscribe()
   setDeviceRegistered(false)
   setPushStatus(removed?'This device was unsubscribed.':'Server record removed; browser unsubscribe could not be confirmed.')
  }catch(err){setPushStatus('Could not unsubscribe: '+(err.message||'unknown error'))}
  finally{setPushBusy(false)}
 }
 async function lookup(){
  const book=books.find(b=>b.id===editing)
  if(!book)return
  setLookingUp(true);setNotice('');setCandidates([])
  try{const matches=await findPublicationCandidates(book);setCandidates(matches);if(!matches.length)setNotice('No exact publication date found. Google Books may only list a year or month; check the publisher and enter the confirmed date manually.')}
  catch(err){setNotice(err.message||'Publication lookup unavailable.')}
  finally{setLookingUp(false)}
 }
 async function save(book,dateValue,active){
  const success=await onSave(book,{release_on:dateValue||null,release_alert_enabled:!!(dateValue&&active)})
  if(success){setEditing('');setDate('')}
 }
 return <section className="releaseReminder"><h3>Book release reminders</h3><p>Enter a confirmed release date for a book in your To Read list. Dates are saved to your account. On the release day, this browser can notify you when Reading Companion is open. This is not background push and release dates are not fetched automatically.</p>
  {installHint&&<p className="statsNote">On iPhone: Safari → Share → Add to Home Screen. iOS Web Push requires the installed app and notification permission.</p>}{workerReady&&<p className="statsNote">Service worker ready. Web Push requires a configured server sender before alerts can arrive in the background.</p>}{workerReady&&<div className="pushControls"><button type="button" className="secondary" disabled={pushBusy} onClick={testLocalNotification}>Test notification on this device</button><button type="button" className="secondary" disabled={pushBusy||!vapidKey} onClick={subscribePush}>{deviceRegistered?'Refresh this device registration':'Register this device for push'}</button><button type="button" className="subtle" disabled={pushBusy} onClick={unsubscribePush}>Unsubscribe this device</button>{!vapidKey&&<p className="statsNote">Background push registration is unavailable until the public VAPID key and secure sender are configured.</p>}<p className="statsNote">Device status: {deviceRegistered?'Registered on this account':'Not registered'} · {vapidKey?'Public push key configured':'Public push key missing'}. A registered device does not guarantee server delivery.</p>{pushStatus&&<p role="status">{pushStatus}</p>}</div>}<div className="statsHeading"><strong>{upcoming.length} upcoming · {tracked.length} tracked</strong><button type="button" className="secondary" onClick={enable} disabled={enabled}>{enabled?'Browser notifications permitted':'Allow browser notifications'}</button></div>
  <label className="checkLabel"><input type="checkbox" checked={subscribed} onChange={e=>setSubscribed(e.target.checked)}/> Show release-day notifications while this page is open</label>
  {notice&&<p role="status">{notice}</p>}
  <div className="releaseList">{upcoming.slice(0,8).map(b=><p key={b.id}><strong>{b.release_on}</strong> · {b.title} <button type="button" className="subtle" onClick={()=>{setEditing(b.id);setDate(b.release_on)}}>Edit</button></p>)}</div>
  <label>Track a To Read book <select value={editing} onChange={e=>{setEditing(e.target.value);setDate(books.find(b=>b.id===e.target.value)?.release_on||'');setCandidates([])}}><option value="">Choose book…</option>{books.filter(b=>b.status==='to_read').map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
  {editing&&<div className="releaseEditor"><button type="button" className="subtle" disabled={lookingUp} onClick={lookup}>{lookingUp?'Searching…':'Find publication dates (Google Books)'}</button>{candidates.length>0&&<div className="releaseCandidates"><p>Check the edition and publisher before selecting. These are catalog dates, not guaranteed future release dates.</p>{candidates.slice(0,8).map(item=><div key={item.id}><button type="button" className="subtle" onClick={()=>setDate(item.date)}>{item.date} · {item.title}{item.publisher?' · '+item.publisher:''}{item.isbnMatch?' · ISBN match':''}</button>{item.link&&<a href={item.link} target="_blank" rel="noopener noreferrer">View source</a>}</div>)}</div>}<label>Verified publication date <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" disabled={!date} onClick={()=>save(books.find(b=>b.id===editing),date,true)}>Save reminder</button><button type="button" className="subtle" onClick={()=>save(books.find(b=>b.id===editing),'',false)}>Remove reminder</button></div>}
 </section>
}
function ReadingRewards({books,sessions}){
 const [showAll,setShowAll]=useState(false)
 const today=new Date()
 const earned=achievements(books,sessions)
 const quests=monthlyQuests(books,sessions,today.getFullYear(),today.getMonth()+1)
 const unlocked=earned.filter(a=>a.unlocked).length
 return <section className="readingRewards" aria-label="Reading achievements and monthly quests">
  <div className="statsHeading"><h2>Achievements & Quests</h2><button type="button" className="subtle" onClick={()=>setShowAll(v=>!v)} aria-expanded={showAll}>{showAll?'Show less':'See all achievements'}</button></div>
  <p>{unlocked} / {earned.length} achievements unlocked. Your quests reset automatically each calendar month, based on completed readings.</p>
  <h3>{today.toLocaleDateString('en',{month:'long',year:'numeric'})} quests</h3>
  <div className="rewardGrid">{quests.map(q=><article key={q.id}><strong>{q.completed?'✓ ':''}{q.name}</strong><p>{q.description}</p><progress max="100" value={q.progress} aria-label={q.name+' progress'}/><small>{q.value} / {q.target}{q.completed?' · Complete':''}</small></article>)}</div>
  <h3>Achievements</h3><div className="rewardGrid">{(showAll?earned:earned.slice(0,3)).map(a=><article key={a.id}><strong>{a.unlocked?'★ ':'☆ '}{a.name}</strong><p>{a.description}</p><progress max="100" value={a.progress} aria-label={a.name+' progress'}/><small>{a.value} / {a.target}{a.unlocked?' · Unlocked':''}</small></article>)}</div>
  <p className="statsNote">Rewards are personal milestones, not competitive scores. DNF books are excluded; unknown page counts are never estimated.</p>
 </section>
}

function StatisticsView({books,sessions,onOpenJournal}){
 const [year,setYear]=useState(new Date().getFullYear())
 const [month,setMonth]=useState(0)
 const stats=readingStatistics(books,sessions)
 const {finished,dated,needsReview,pages,average,countBy,forYear,forMonth}=stats
 const yearly=forYear(year)
 const monthly=monthNames.map((name,i)=>({name,items:forMonth(year,i+1)}))
 const selected=month===0?yearly:monthly[month-1].items
 const formatCounts=countBy(selected,b=>b.book_format||'unspecified')
 const authorCounts=countBy(selected,b=>b.author?.trim()||'Unknown author')
 const topAuthors=Object.entries(authorCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5)
 const current=new Date().getFullYear()
 const years=[...new Set([current,...dated.map(b=>Number(b.finished_on.slice(0,4)))])].sort((a,b)=>b-a)
 const maxMonth=Math.max(1,...monthly.map(m=>m.items.length))
 return <section className="stats">
  <div className="hero"><h2>Your reading statistics</h2><p>Completed reading sessions are counted by finish date. DNF and undated readings are excluded from dated totals. Unknown values are never estimated.</p></div>
  <h2>Lifetime</h2><div className="statGrid">
   <article><strong>{stats.completedReadings}</strong><span>Dated completed readings</span></article>
   <article><strong>{stats.uniqueFinished}</strong><span>Finished books</span></article>
   <article><strong>{stats.rereads}</strong><span>Dated rereads</span></article>
   <article><strong>{pages(dated).toLocaleString('en-US')}</strong><span>Known pages · dated readings</span></article>
   <article><strong>{average(finished)}</strong><span>Average book rating</span></article>
   <article><strong>{finished.filter(b=>b.favorite).length}</strong><span>Favorites</span></article>
  </div>
  <div className="statGrid"><article><strong>{books.filter(b=>b.status==='reading').length}</strong><span>Currently reading</span></article><article><strong>{books.filter(b=>b.status==='to_read').length}</strong><span>To Read</span></article><article><strong>{books.filter(b=>b.status==='dnf').length}</strong><span>DNF (excluded)</span></article></div>
  <p className="statsNote">{stats.missingDatedBooks} finished books without a valid dated completion; {stats.missingPages} dated readings without a known page count. Page totals sum the known full book lengths for each completed reading, including rereads.</p>
  <div className="statsHeading"><h2>Yearly</h2><label>Year <select value={year} onChange={e=>{setYear(Number(e.target.value));setMonth(0)}}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
  <div className="statGrid">
   <article><strong>{yearly.length}</strong><span>Completed readings</span></article>
   <article><strong>{new Set(yearly.map(b=>b.id)).size}</strong><span>Distinct books</span></article>
   <article><strong>{pages(yearly).toLocaleString('en-US')}</strong><span>Known pages</span></article>
   <article><strong>{average(yearly)}</strong><span>Average rating</span></article>
  </div>
  <h2>Monthly · {year}</h2><div className="monthGrid">{monthly.map((m,i)=><button type="button" key={m.name} className="statsMonthButton" aria-pressed={month===i+1} onClick={()=>setMonth(month===i+1?0:i+1)}><strong>{m.name}</strong><span>{m.items.length} {m.items.length===1?'reading':'readings'}</span><small>{pages(m.items).toLocaleString('en-US')} known pages</small></button>)}</div>
  <h3>Monthly reading activity</h3><div className="statsMonthBars" role="img" aria-label={'Completed readings by month in '+year+': '+monthly.map(m=>m.name+' '+m.items.length).join(', ')}>{monthly.map(m=><div key={m.name} className="statsMonthBar"><span title={m.name+': '+m.items.length+' completed readings'} style={{height:Math.max(3,100*m.items.length/maxMonth)+'%'}}/><small>{m.name.slice(0,3)}</small></div>)}</div>
  <h2>Reading breakdown · {month?monthNames[month-1]+' ':''}{year}</h2><div className="statGrid"><article><h3>Formats</h3>{Object.entries(formatCounts).sort((a,b)=>b[1]-a[1]).map(([format,count])=><p key={format}>{formats.find(f=>f[0]===format)?.[1]||'Not specified'}: <strong>{count}</strong></p>)}{!selected.length&&<p>No completed readings.</p>}</article><article><h3>Most-read authors</h3>{topAuthors.map(([author,count])=><p key={author}>{author}: <strong>{count}</strong></p>)}{!topAuthors.length&&<p>No completed readings.</p>}</article></div>
  {needsReview.length>0&&<section className="statsReview"><h3>Books needing date review ({needsReview.length})</h3><p>Check the journal entries below. Invalid or missing session dates cannot be assigned to a year.</p><ul>{needsReview.slice(0,20).map(b=><li key={b.id}><button type="button" className="subtle" onClick={()=>onOpenJournal(b)}>{b.title} · Review dates</button></li>)}</ul>{needsReview.length>20&&<p>And {needsReview.length-20} more.</p>}</section>}
  <h2>Readings completed in {month?monthNames[month-1]+' ':''}{year}</h2>
  <div className="cards">{selected.slice().sort((a,b)=>b.finished_on.localeCompare(a.finished_on)).map(b=><article key={b.session_id||b.id}><strong>{b.title}</strong><p>{b.finished_on} · {b.author||'Unknown author'}{b.session_id?' · Reading session':''}</p><button type="button" className="subtle" onClick={()=>onOpenJournal(b)}>Open journal</button></article>)}{!selected.length&&<p>No dated completed readings for this period.</p>}</div>
 </section>
}
const worldCities={
 A:{easy:['New York City','London','Boston','Chicago','Los Angeles','Paris','Seattle','San Francisco','Toronto','Washington, D.C.'],challenge:['Rome','Dublin','Barcelona','Sydney','Tokyo','Amsterdam','Florence','Lisbon','Vancouver','Edinburgh']},
 B:{easy:['New York City','London','Philadelphia','Miami','Nashville','New Orleans','Montreal','Oxford','Milan','Madrid'],challenge:['Prague','Vienna','Copenhagen','Athens','Seoul','Singapore','Istanbul','Melbourne','Berlin','Porto']}
}
function AroundWorldView({books,sessions,session,year,variant}){
 const [entries,setEntries]=useState([])
 const [error,setError]=useState('')
 const [pending,setPending]=useState(null)
 const [verified,setVerified]=useState(false)
 const [busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;setEntries([]);setPending(null);setVerified(false);supabase.from('rc_world_entries').select('id,city,book_id').eq('challenge_year',year).then(({data,error})=>{if(active){if(error)setError(error.message);else{setEntries(data||[]);setError('')}}});return()=>{active=false}},[year,session.user.id])
 const eligible=eligibleChallengeBooks(books,sessions,year).filter(b=>!entries.some(e=>e.book_id===b.id))
 async function refresh(){const {data,error}=await supabase.from('rc_world_entries').select('id,city,book_id').eq('challenge_year',year);if(error)setError(error.message);else setEntries(data||[])}
 async function assign(){
  if(!pending||!verified)return
  setBusy(true);setError('')
  const {error}=await supabase.from('rc_world_entries').insert({user_id:session.user.id,challenge_year:year,city:pending.city,book_id:pending.bookId,verified_by_user:true})
  if(error)setError(error.message);else{setPending(null);setVerified(false)}
  await refresh();setBusy(false)
 }
 async function remove(entry){setBusy(true);const {error}=await supabase.from('rc_world_entries').delete().eq('id',entry.id);if(error)setError(error.message);await refresh();setBusy(false)}
 const groups=worldCities[variant]
 return <section>
  <h2>Around the World · Version {variant}</h2><p>{entries.length} / 20 cities filled</p>
  <p className="statsNote">Choose a book only when you have checked that the story is substantially set in that city (at least 70% confidence). The app does not infer locations from titles.</p>
  {error&&<p role="alert" className="message">{error}</p>}
  {Object.entries(groups).map(([group,cities])=><div key={group}><h3>{group==='easy'?'Easy cities':'Challenge cities'}</h3><div className="alphabetGrid">{cities.map(city=>{
   const entry=entries.find(e=>e.city===city)
   const book=entry&&books.find(b=>b.id===entry.book_id)
   return <article key={city} className={entry?'filled':''}><strong className="cityTitle">{city}</strong><span>{book?book.title:'Available'}</span>
   {entry?<button className="subtle" disabled={busy} onClick={()=>remove(entry)}>Remove</button>:<select value="" disabled={busy||!eligible.length} aria-label={'Choose a book for '+city} onChange={e=>{setPending({city,bookId:e.target.value});setVerified(false)}}><option value="">{eligible.length?'Choose book…':'No eligible books'}</option>{eligible.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>}
   </article>
  })}</div></div>)}
  {pending&&<div className="modalBackdrop"><section className="editor" role="dialog" aria-modal="true" aria-label="Confirm city match"><h2>Confirm {pending.city}</h2><p>{books.find(b=>b.id===pending.bookId)?.title}</p><label className="checkLabel"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> I verified that this book matches the city with at least 70% confidence.</label><div className="editorActions"><button className="secondary" onClick={()=>setPending(null)}>Cancel</button><button disabled={!verified||busy} onClick={assign}>Assign book</button></div></section></div>}
 </section>
}
const archetypeCatalog={"A":["The Grump","Golden Retriever","Playboy","Morally Grey Hero","Protective Hero","Strong Heroine","Loyal Sidekick","Boy Next Door","Hopeless Romantic","Rival","Warrior","Healer","Trickster","Monster with a Heart","Single Parent","Chosen One","Mentor","Royal","Nerd/Bookworm","Introvert"],"B":["The Sunshine","Ice Queen","Bad Boy","The Witch","Cinnamon Roll","Broken Hero","The Loner","The Workaholic","Girl Next Door",null,"The Immortal"]}
const tropeCatalog={"A":["Enemies to Lovers","Friends to Lovers","Fake Dating","Marriage of Convenience","Forced Proximity","Slow Burn","Only One Bed","Grumpy × Sunshine","Found Family","Second Chance","Forbidden Love","Royal Romance","Morally Grey Hero","Opposites Attract","Secret Identity","Hidden Powers","Academy Setting","Fated Mates","Arranged Marriage","Best Friend’s Brother"],"B":["Sports Romance","Brother’s Best Friend","Pen Pals","Single Parent","Workplace Romance","Small Town Romance","Holiday Romance","Roommates","Neighbors to Lovers","Childhood Friends to Lovers","Age Gap","Mistaken Identity","Love at First Sight","Friends with Benefits","Love Triangle","Amnesia","Revenge","He Falls First","She Falls First","Surprise Pregnancy"]}
function PromptChallengeView({books,sessions,session,year,variant,challenge}){
 const [prompts,setPrompts]=useState([])
 const [assignments,setAssignments]=useState([])
 const [drafts,setDrafts]=useState({})
 const [pending,setPending]=useState(null)
 const [verified,setVerified]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 async function refresh(){
  const [p,a]=await Promise.all([
   supabase.from('rc_custom_prompts').select('id,position,label').eq('challenge',challenge).eq('variant',variant).order('position'),
   supabase.from('rc_prompt_assignments').select('id,prompt_id,book_id').eq('challenge_year',year)
  ])
  if(p.error||a.error)setError(p.error?.message||a.error?.message)
  else{
   let list=p.data||[]
   if(challenge==='tropes'||challenge==='archetypes'){
    const catalog=challenge==='tropes'?tropeCatalog[variant]:archetypeCatalog[variant]
    const missing=catalog.flatMap((label,i)=>!label||list.some(x=>x.position===i+1)?[]:[{user_id:session.user.id,challenge,variant,position:i+1,label}])
    if(missing.length){
     const inserted=await supabase.from('rc_custom_prompts').upsert(missing,{onConflict:'user_id,challenge,variant,position',ignoreDuplicates:true})
     if(inserted.error)setError(inserted.error.message)
     const latest=await supabase.from('rc_custom_prompts').select('id,position,label').eq('challenge',challenge).eq('variant',variant).order('position')
     if(!latest.error)list=latest.data||[]
    }
   }
   setPrompts(list);setAssignments((a.data||[]).filter(x=>list.some(y=>y.id===x.prompt_id)))
  }
 }
 useEffect(()=>{setPrompts([]);setAssignments([]);setDrafts({});setPending(null);refresh()},[year,variant,challenge,session.user.id])
 async function savePrompt(position){
  const label=(drafts[position]??prompts.find(p=>p.position===position)?.label??'').trim()
  if(!label)return
  setBusy(true);setError('')
  const existing=prompts.find(p=>p.position===position)
  const payload={user_id:session.user.id,challenge,variant,position,label}
  const {error}=existing?await supabase.from('rc_custom_prompts').update({label}).eq('id',existing.id):await supabase.from('rc_custom_prompts').insert(payload)
  if(error)setError(error.message);else setDrafts(d=>({...d,[position]:undefined}))
  await refresh();setBusy(false)
 }
 async function assign(){
  if(!pending||!verified)return
  setBusy(true);setError('')
  const {error}=await supabase.from('rc_prompt_assignments').insert({user_id:session.user.id,prompt_id:pending.promptId,book_id:pending.bookId,challenge_year:year,verified_by_user:true})
  if(error)setError(error.message);else{setPending(null);setVerified(false)}
  await refresh();setBusy(false)
 }
 async function remove(id){setBusy(true);const {error}=await supabase.from('rc_prompt_assignments').delete().eq('id',id);if(error)setError(error.message);await refresh();setBusy(false)}
 const eligible=eligibleChallengeBooks(books,sessions,year).filter(b=>!assignments.some(a=>a.book_id===b.id)&&!(challenge==='tropes'&&b.series_name?.trim()&&assignments.filter(a=>{const other=books.find(x=>x.id===a.book_id);return other?.series_name?.trim().toLowerCase()===b.series_name.trim().toLowerCase()}).length>=2))
 return <section>
  <h2>{challenge==='tropes'?'Tropes':'Archetypes'} · Version {variant}</h2>
  <p>{assignments.length} filled · {prompts.length} defined prompts</p>
  {challenge==='archetypes'&&variant==='B'&&<p className="statsNote">Version B: slot 10 is intentionally undefined; slots 12–20 await your original prompts.</p>}
  <p className="statsNote">{challenge==='tropes'?'The 20 official prompts are prefilled. A book can fill only one trope per year, with at most two books from the same series.':'Known Archetypes prompts are prefilled. Unconfirmed positions remain blank; add them only from your original list.'} Assign only verified matches (at least 70% confidence).</p>
  {error&&<p className="message" role="alert">{error}</p>}
  <div className="alphabetGrid">{Array.from({length:20},(_,i)=>i+1).map(position=>{
   const prompt=prompts.find(p=>p.position===position)
   const entry=prompt&&assignments.find(a=>a.prompt_id===prompt.id)
   const book=entry&&books.find(b=>b.id===entry.book_id)
   const value=drafts[position]??prompt?.label??''
   const intentionallyEmpty=challenge==='archetypes'&&variant==='B'&&position===10
   return <article key={position} className={entry?'filled':''}><strong>{position}</strong>
    {entry?<><span>{prompt.label}</span><small>{book?.title||'Book unavailable'}</small><button className="subtle" disabled={busy} onClick={()=>remove(entry.id)}>Remove</button></>:<>
     <input aria-label={'Prompt '+position} placeholder={intentionallyEmpty?'Intentionally blank':'Exact prompt…'} disabled={intentionallyEmpty} value={value} readOnly={challenge==='tropes'} onChange={e=>setDrafts(d=>({...d,[position]:e.target.value}))}/>
     {challenge!=='tropes'&&value.trim()&&value.trim()!==prompt?.label&&<button className="subtle" disabled={busy} onClick={()=>savePrompt(position)}>Save prompt</button>}
     {prompt&&<select aria-label={'Assign book to '+prompt.label} value="" disabled={busy||!eligible.length} onChange={e=>{setPending({promptId:prompt.id,bookId:e.target.value});setVerified(false)}}><option value="">{eligible.length?'Choose book…':'No eligible books'}</option>{eligible.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>}
    </>}
   </article>
  })}</div>
  {pending&&<div className="modalBackdrop"><section className="editor" role="dialog" aria-modal="true" aria-label="Confirm prompt match"><h2>Confirm assignment</h2><p>{books.find(b=>b.id===pending.bookId)?.title}</p><label className="checkLabel"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> I verified this match with at least 70% confidence.</label><div className="editorActions"><button className="secondary" onClick={()=>setPending(null)}>Cancel</button><button disabled={!verified||busy} onClick={assign}>Assign book</button></div></section></div>}
 </section>
}
const calendarMonths=[["January","Fresh Starts"],["February","Love Stories"],["March","Read Outside the Box"],["April","Spring Awakening"],["May","Whimsical Reads"],["June","Summer Escape"],["July","Adventure Awaits"],["August","Backlist Treasures"],["September","Back to School"],["October","Dark & Mysterious"],["November","Cozy Reads"],["December","Winter Magic"]]
const calendarCatalog={"monthly":{"A":[["A New-to-You Author","The First Book in a Series","A Book You’ve Been Meaning to Read"],["Enemies Before Lovers","A Love Story in a City You Love","Love Against the Odds"],["A Genre You’ve Never Read","A Book You Wouldn’t Normally Pick","Judge a Book by Its Cover"],["A Book with Flowers on the Cover","A Story About New Beginnings","A Book Set in the Countryside"],["A Book with a Magical Creature","A Fairytale-Inspired Story","A Book with a Magical Object"],["A Book Set by the Sea","A Summer Romance","A Book with a Sunny Cover"],["A Journey to an Unknown Place","A Quest or Mission","A Book Set in the Wilderness"],["A Book on Your TBR for Over a Year","An Older Book by a Favorite Author","A Forgotten TBR Pick"],["A Book Set at a School or University","A Book About an Ambitious Character","A Book That Teaches You Something"],["A Murder Mystery","A Book with a Secret Society","A Book Featuring a Curse"],["A Small-Town Setting","A Book Featuring a Bookshop or Library","A Comfort Read"],["A Book Set During Winter","A Holiday Romance","A Book with Snow on the Cover"]],"B":[["A Genre You Rarely Read","A Recent Addition to Your TBR","A Fresh Release"],["Friends Before Lovers","An Unexpected Romance","More Than Romantic Love"],["Let Someone Else Choose Your Read","A Book with an Unusual Premise","A Book That Divides Readers"],["A Pastel-Colored Cover","A Story About Personal Growth","A Character with Nature-Based Powers"],["A Book Featuring a Witch","A Story with a Touch of Magic","A Book with a Whimsical Cover"],["A Vacation Gone Wrong","A Book Set on an Island","A Road Trip Story"],["A Dangerous Journey","A Search for Something Lost","An Adventure with an Unlikely Team"],["The Oldest Book on Your TBR","A Book You Bought but Never Read","A Series You’ve Been Meaning to Continue"],["A Dark Academia Read","A Book Featuring a Competition","A Book with a Mentor–Student Dynamic"],["A Psychological Thriller","A Book with a Mysterious Disappearance","A Book Featuring Dark Magic"],["A Book Set During Autumn","A Story Centered Around Family","A Book Featuring Food or Baking"],["A Book Set During the Holidays","A Book Set Somewhere Cold","A Book Featuring a Winter Sport"]]},"seasonal":{"A":[["A Book with an Animal on the Cover","A Book Featuring a Flower Shop","A Book with a Character Named After a Flower or Plant","A Book with a Colorful Cover","A Book with a Bird on the Cover"],["A Book Set in a Coastal Town","A Book Featuring a Road Trip","A Book with Sunglasses on the Cover","A Book Set on an Island","A Book Featuring a Summer Festival"],["A Book Set in a Small Town","A Book Featuring a Family Gathering","A Book Featuring Baking","A Book with Autumn Leaves on the Cover","A Book with an Orange Cover"],["A Book Set Somewhere Cold","A Book Featuring a Winter Sport","A Book Featuring a Snowstorm","A Book with a Cozy Winter Cover","A Book Featuring a Cabin"]],"B":[["A Book with Flowers on the Cover","A Book Set in the Countryside","A Book Featuring a Picnic","A Book Featuring a Rainy Setting","A Book Set on a Farm"],["A Book Featuring a Swimming Pool","A Book Set at a Beach Resort","A Book with a Tropical Cover","A Book Featuring a 4th of July Celebration","A Book Set During a Heatwave"],["A Book Featuring a Pumpkin","A Book Set in a Bookshop","A Book Featuring Apple Picking","A Book Set During Autumn","A Book Featuring a Bonfire"],["A Book with Snow on the Cover","A Holiday Romance","A Book Featuring Ice Skating","A Book Featuring a Christmas Market","A Book Featuring a Fireplace"]]}}
const seasons=['Spring','Summer','Autumn','Winter']
function CalendarChallengeView({books,sessions,session,year,variant,challenge}){
 const [entries,setEntries]=useState([])
 const [error,setError]=useState('')
 const [pending,setPending]=useState(null)
 const [confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false)
 const [selected,setSelected]=useState(challenge==='monthly'?'January':'Spring')
 const slots=challenge==='monthly'?calendarMonths.map(x=>x[0]):seasons
 const slotIndex=slots.indexOf(selected)
 const prompts=calendarCatalog[challenge][variant][slotIndex]||[]
 useEffect(()=>{setSelected(challenge==='monthly'?'January':'Spring')},[challenge])
 async function refresh(){
  const {data,error}=await supabase.from('rc_calendar_challenge_entries').select('id,slot,prompt_index,book_id').eq('challenge',challenge).eq('challenge_year',year)
  if(error)setError(error.message);else{setEntries(data||[]);setError('')}
 }
 useEffect(()=>{setEntries([]);setPending(null);refresh()},[year,challenge,session.user.id])
 const monthNumber=calendarMonths.findIndex(x=>x[0]===selected)+1
 const seasonMonths={Spring:[3,4,5],Summer:[6,7,8],Autumn:[9,10,11],Winter:[12,1,2]}
 const eligible=eligibleChallengeBooksForMonth(books,sessions,year,challenge==='monthly'?[monthNumber]:seasonMonths[selected]).filter(b=>!entries.some(e=>e.book_id===b.id))
 async function assign(){
  if(!pending||!confirmed)return
  setBusy(true);setError('')
  const {error}=await supabase.from('rc_calendar_challenge_entries').insert({user_id:session.user.id,challenge,challenge_year:year,slot:selected,prompt_index:pending.index,book_id:pending.bookId,verified_by_user:true})
  if(error)setError(error.message);else{setPending(null);setConfirmed(false)}
  await refresh();setBusy(false)
 }
 async function remove(id){setBusy(true);const {error}=await supabase.from('rc_calendar_challenge_entries').delete().eq('id',id);if(error)setError(error.message);await refresh();setBusy(false)}
 return <section>
  <h2>{challenge==='monthly'?'Monthly':'Seasonal'} Challenge · Version {variant}</h2>
  <p>{entries.length} / {challenge==='monthly'?36:20} prompts filled</p>
  <div className="challengeSwitch">{slots.map(slot=><button key={slot} className={selected===slot?'active':''} onClick={()=>{setSelected(slot);setPending(null)}}>{slot}{entries.some(e=>e.slot===slot)?' · '+entries.filter(e=>e.slot===slot).length:''}</button>)}</div>
  <h3>{selected}{challenge==='monthly'?' — '+calendarMonths[slotIndex][1]:''}</h3>
  <p className="statsNote">Books must be finished during {challenge==='monthly'?'the selected month':'the selected season'} of {year}. Each book can fill only one prompt in this challenge for the year. Confirm a match only when you have verified it with at least 70% confidence.</p>
  {error&&<p className="message" role="alert">{error}</p>}
  <div className="alphabetGrid">{prompts.map((label,i)=>{
   const entry=entries.find(e=>e.slot===selected&&e.prompt_index===i+1)
   const book=entry&&books.find(b=>b.id===entry.book_id)
   return <article key={i} className={entry?'filled':''}><strong className="cityTitle">{label}</strong><span>{book?.title||'Available'}</span>
    {entry?<button className="subtle" disabled={busy} onClick={()=>remove(entry.id)}>Remove</button>:<select aria-label={'Choose book for '+label} value="" disabled={busy||!eligible.length} onChange={e=>{setPending({index:i+1,bookId:e.target.value});setConfirmed(false)}}><option value="">{eligible.length?'Choose book…':'No eligible books'}</option>{eligible.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>}
   </article>
  })}</div>
  {pending&&<div className="modalBackdrop"><section className="editor" role="dialog" aria-modal="true" aria-label="Confirm prompt match"><h2>Confirm assignment</h2><p>{books.find(b=>b.id===pending.bookId)?.title}</p><p>{prompts[pending.index-1]}</p><label className="checkLabel"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I verified this match with at least 70% confidence.</label><div className="editorActions"><button className="secondary" onClick={()=>setPending(null)}>Cancel</button><button disabled={!confirmed||busy} onClick={assign}>Assign book</button></div></section></div>}
 </section>
}
const rouletteCatalog={"A":[["Roll the Dice","Choose 6 TBR books, number them 1–6, and roll a die."],["Blind Pick","Gather several physical books, close your eyes, and pick one."],["Random Number","Number your TBR books and use a random number generator to pick one."],["Let Someone Else Choose","Offer someone a shortlist and let them choose your next read."],["Spin the Wheel","Put several titles on a random wheel and spin it."],["Shelf Lucky Dip","Choose a shelf at random, then a random position on that shelf."],["First Letter Draw","Draw a random letter and pick a book whose title starts with it."],["Page Number Pick","Draw a random number and choose the TBR book closest to that page count."],["Oldest vs Newest","Flip a coin: heads = oldest TBR book; tails = newest addition."],["Pick a Color","Draw a color at random and choose a book with that color on its cover."]],"B":[["Three-Book Shuffle","Choose 3 books, shuffle them without looking, and take the middle one."],["Coin Flip Tournament","Pick 4 books; play two head-to-head coin-flip rounds, then a final."],["Random Author","Randomly pick an author from your TBR, then choose one of their books."],["Pick a Shelf Number","Number your shelves, draw a shelf number, and choose a book from it."],["Random Genre","Randomly draw a genre in your TBR, then choose a book from that genre."],["Bookstore Memory","Think of unread purchases and randomly choose from the first 5 titles that come to mind."],["Last Digit Pick","Use the last digit of the current minute to select a position among 10 books."],["Random Series","Randomly select a series you have started and read its next unread volume."],["Five-Book Lucky Pick","Number 5 TBR books 1–5 and ask someone to pick a number without seeing the titles."],["The Final Two","Randomly draw 2 books, then flip a coin to decide which to read."]]}
function RouletteView({books,sessions,session,year,variant}){
 const [prompts,setPrompts]=useState([])
 const [entries,setEntries]=useState([])
 const [pending,setPending]=useState(null)
 const [verified,setVerified]=useState(false)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [seriesSuggestion,setSeriesSuggestion]=useState(null)
 const catalog=rouletteCatalog[variant]
 const seriesGroups=Object.values(books.filter(b=>b.series_name?.trim()).reduce((acc,b)=>{const key=b.series_name.trim().toLocaleLowerCase();if(!acc[key])acc[key]=[];acc[key].push(b);return acc},{}))
 const seriesCandidates=seriesGroups.flatMap(group=>{
  if(!group.some(b=>['finished','reading'].includes(b.status)))return []
  const unread=group.filter(b=>b.status==='to_read'&&b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number!=null&&Number.isInteger(Number(b.series_number))&&Number(b.series_number)>=1).sort((a,b)=>Number(a.series_number)-Number(b.series_number))
  if(!unread.length)return []
  const next=unread[0]
  const previous=group.filter(b=>['finished','reading'].includes(b.status)&&b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number!=null)
  if(!previous.length||!previous.some(b=>Number(b.series_number)<Number(next.series_number)))return []
  const priorUnread=group.some(b=>b.status==='to_read'&&b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number!=null&&Number(b.series_number)<Number(next.series_number))
  if(priorUnread)return []
  return [{name:next.series_name,book:next}]
 })
 function drawSeries(){
  if(!seriesCandidates.length){setSeriesSuggestion(null);return}
  const pick=seriesCandidates[Math.floor(Math.random()*seriesCandidates.length)]
  setSeriesSuggestion(pick)
 }
 async function refresh(){
  const {data:p,error:pe}=await supabase.from('rc_roulette_prompts').select('id,position,label,explanation').eq('challenge_year',year).order('position')
  if(pe){setError(pe.message);return}
  let list=p||[]
  const canonical=catalog.map(([label,explanation],i)=>({user_id:session.user.id,challenge_year:year,variant,position:i+1,label,explanation}))
  const needsSync=canonical.some(item=>{const existing=list.find(x=>x.position===item.position);return !existing||existing.label!==item.label||existing.explanation!==item.explanation})
  if(needsSync){
   const {error}=await supabase.from('rc_roulette_prompts').upsert(canonical,{onConflict:'user_id,challenge_year,position'})
   if(error){setError(error.message);return}
   const latest=await supabase.from('rc_roulette_prompts').select('id,position,label,explanation').eq('challenge_year',year).order('position')
   if(latest.error){setError(latest.error.message);return}
   list=latest.data||[]
  }
  const {data:e,error:ee}=await supabase.from('rc_roulette_entries').select('id,prompt_id,book_id').in('prompt_id',list.map(x=>x.id))
  if(ee)setError(ee.message);else{setPrompts(list);setEntries(e||[]);setError('')}
 }
 useEffect(()=>{setPrompts([]);setEntries([]);setPending(null);refresh()},[year,variant,session.user.id])
 const eligible=eligibleChallengeBooks(books,sessions,year).filter(b=>!entries.some(e=>e.book_id===b.id))
 async function assign(){
  if(!pending||!verified)return
  setBusy(true);setError('')
  const {error}=await supabase.from('rc_roulette_entries').insert({user_id:session.user.id,prompt_id:pending.promptId,book_id:pending.bookId,verified_by_user:true})
  if(error)setError(error.message);else{setPending(null);setVerified(false)}
  await refresh();setBusy(false)
 }
 async function remove(id){setBusy(true);const {error}=await supabase.from('rc_roulette_entries').delete().eq('id',id);if(error)setError(error.message);await refresh();setBusy(false)}
 return <section className="rouletteChallenge">
  <h2>Reading Roulette · Version {variant}</h2>
  <p>{entries.length} / 10 mechanisms completed · {year}</p>
  <p className="statsNote">Use each mechanism to choose your next read from your TBR. After finishing that book, record its title here.</p>
  {error&&<p className="message" role="alert">{error}</p>}
  {variant==='B'&&<div className="rouletteSeriesTool"><div><strong>Random Series helper</strong><p>Draw a started series with a numbered unread volume in your TBR. Only volumes recorded in your library are considered. Check for missing volumes before starting; record the challenge after reading.</p></div><button disabled={!seriesCandidates.length} onClick={drawSeries}>Draw a series</button>{seriesSuggestion&&<p role="status"><strong>{seriesSuggestion.name}</strong> — {seriesSuggestion.book.title} (volume {seriesSuggestion.book.series_number})</p>}{!seriesCandidates.length&&<small>No eligible started series with a numbered unread volume yet.</small>}</div>}
  <div className="rouletteSpread">{[0,1].map(page=><section key={page} className="roulettePage" aria-label={'Reading Roulette page '+(page+1)}>
   <div className="roulettePageHeading"><span>READING ROULETTE</span><strong>{page===0?'01 — 05':'06 — 10'}</strong></div>
   {catalog.slice(page*5,page*5+5).map(([label,explanation],i)=>{
    const position=page*5+i+1
    const prompt=prompts.find(p=>p.position===position)
    const entry=prompt&&entries.find(e=>e.prompt_id===prompt.id)
    const book=entry&&books.find(b=>b.id===entry.book_id)
    return <article className="rouletteEntry" key={position}>
     <span className="rouletteNumber">{String(position).padStart(2,'0')}</span>
     <div className="rouletteContent"><h3>{label}</h3><p>{explanation}</p>
      {entry?<div className="rouletteTitle"><span>Title</span><strong>{book?.title||'Book unavailable'}</strong><button className="subtle" disabled={busy} onClick={()=>remove(entry.id)}>Remove</button></div>:
       <div className="rouletteTitle"><label htmlFor={'roulette-'+position}>Title</label><select id={'roulette-'+position} value="" disabled={busy||!eligible.length||!prompt} onChange={e=>{setPending({promptId:prompt.id,bookId:e.target.value});setVerified(false)}}><option value="">{!prompt?'Loading…':eligible.length?'Choose completed book…':'No eligible books'}</option>{eligible.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></div>}
     </div>
    </article>
   })}
   <div className="roulettePageFooter">VERSION {variant} · {year}</div>
  </section>)}</div>
  {pending&&<div className="modalBackdrop"><section className="editor" role="dialog" aria-modal="true" aria-label="Confirm roulette selection"><h2>Confirm your pick</h2><p>{books.find(b=>b.id===pending.bookId)?.title}</p><label className="checkLabel"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> I used this mechanism to choose the book from my TBR.</label><div className="editorActions"><button className="secondary" onClick={()=>setPending(null)}>Cancel</button><button disabled={!verified||busy} onClick={assign}>Record book</button></div></section></div>}
 </section>
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
function ChallengesView({books,sessions,session}){
 const [year,setYear]=useState(new Date().getFullYear())
 const [challengeTab,setChallengeTab]=useState('alphabet')
 const [entries,setEntries]=useState([])
 const [error,setError]=useState('')
 const [working,setWorking]=useState(false)
 const variant=challengeVariant(year)
 useEffect(()=>{let active=true;supabase.from('rc_challenge_entries').select('id,prompt,book_id').eq('challenge','alphabet').eq('challenge_year',year).then(({data,error})=>{if(active){if(error)setError(error.message);else{setEntries(data||[]);setError('')}}});return()=>{active=false}},[year,session.user.id])
 const available=eligibleChallengeBooks(books,sessions,year)
 async function assign(letter,bookId){
  setWorking(true);setError('')
  const existing=entries.find(e=>e.prompt===letter)
  const {error}=bookId?await supabase.from('rc_challenge_entries').insert({user_id:session.user.id,challenge:'alphabet',challenge_year:year,prompt:letter,book_id:bookId}):existing?await supabase.from('rc_challenge_entries').delete().eq('id',existing.id):{error:null}
  if(error)setError(error.message)
  const result=await supabase.from('rc_challenge_entries').select('id,prompt,book_id').eq('challenge','alphabet').eq('challenge_year',year)
  if(result.error)setError(result.error.message);else setEntries(result.data||[])
  setWorking(false)
 }
 const years=challengeYears(books,sessions)
 return <section className="challenges">
  <div className="hero"><h2>Reading challenges</h2><p>Seven challenges, one reading year. Choose a challenge to view its prompts and record your books.</p></div>
  <div className="challengeSwitch"><button className={challengeTab==='alphabet'?'active':''} onClick={()=>setChallengeTab('alphabet')}>Alphabet</button><button className={challengeTab==='world'?'active':''} onClick={()=>setChallengeTab('world')}>Around the World</button><button className={challengeTab==='tropes'?'active':''} onClick={()=>setChallengeTab('tropes')}>Tropes</button><button className={challengeTab==='archetypes'?'active':''} onClick={()=>setChallengeTab('archetypes')}>Archetypes</button><button className={challengeTab==='monthly'?'active':''} onClick={()=>setChallengeTab('monthly')}>Monthly</button><button className={challengeTab==='seasonal'?'active':''} onClick={()=>setChallengeTab('seasonal')}>Seasonal</button><button className={challengeTab==='roulette'?'active':''} onClick={()=>setChallengeTab('roulette')}>Reading Roulette</button></div>
  <div className="statsHeading"><h2>{({alphabet:'Alphabet Challenge',world:'Around the World',tropes:'Tropes Challenge',archetypes:'Archetypes Challenge',monthly:'Monthly Challenge',seasonal:'Seasonal Challenge',roulette:'Reading Roulette'})[challengeTab]} · Version {variant}</h2><label>Year <select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
  {challengeTab==='roulette'?<RouletteView key={year} books={books} sessions={sessions} session={session} year={year} variant={variant}/>:challengeTab==='monthly'||challengeTab==='seasonal'?<CalendarChallengeView key={challengeTab+year} books={books} sessions={sessions} session={session} year={year} variant={variant} challenge={challengeTab}/>:challengeTab==='world'?<AroundWorldView books={books} sessions={sessions} session={session} year={year} variant={variant}/>:challengeTab==='tropes'||challengeTab==='archetypes'?<PromptChallengeView key={challengeTab+year} books={books} sessions={sessions} session={session} year={year} variant={variant} challenge={challengeTab}/>:<>
  <p>{entries.length} / 26 letters filled · {26-entries.length} available</p>
  {error&&<p role="alert" className="message">{error}</p>}
  <div className="alphabetGrid">{alphabet.map(letter=>{
   const assigned=entries.find(e=>e.prompt===letter)
   const match=assigned&&books.find(b=>b.id===assigned.book_id)
   const choices=available.filter(b=>b.title.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase()===letter&&!entries.some(e=>e.book_id===b.id))
   return <article key={letter} className={assigned?'filled':''}><strong>{letter}</strong><span>{match?match.title:'Available'}</span>
    {assigned?<button className="subtle" disabled={working} onClick={()=>assign(letter,null)}>Remove</button>:<select aria-label={'Assign a book to letter '+letter} disabled={working||!choices.length} value="" onChange={e=>assign(letter,e.target.value)}><option value="">{choices.length?'Choose book…':'No eligible books'}</option>{choices.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>}
   </article>
  })}</div>
  <p className="statsNote">Eligible books must be marked Finished, have a finish date in the selected year, and begin with the selected letter. Challenge entries are assigned manually; the app never guesses a book's trope, archetype or setting.</p></>}
 </section>
}
function SeriesShelf({books,onEdit,onStart,onViewLibrary,session}){
 const [metadata,setMetadata]=useState([])
 const [saving,setSaving]=useState('')
 const [error,setError]=useState('')
 const [seriesQuery,setSeriesQuery]=useState('')
 const [seriesFilter,setSeriesFilter]=useState('all')
 const [seriesSort,setSeriesSort]=useState('name')
 const [showSeriesWarningsOnly,setShowSeriesWarningsOnly]=useState(false)
 useEffect(()=>{let active=true;supabase.from('rc_series').select('id,name,status,total_volumes').then(({data,error})=>{if(active){if(error)setError(error.message);else setMetadata(data||[])}});return()=>{active=false}},[session.user.id])
 async function saveSeries(group,status,total){
  setSaving(group.name);setError('')
  const value=total===''?null:Number(total)
  if(value!==null&&(!Number.isInteger(value)||value<1)){setError('Total volumes must be a positive whole number.');setSaving('');return}
  const existing=metadata.find(m=>m.name.toLocaleLowerCase()===group.name.toLocaleLowerCase())
  const payload={user_id:session.user.id,name:group.name,status,total_volumes:value}
  const {data,error}=existing?await supabase.from('rc_series').update({status,total_volumes:value}).eq('id',existing.id).select('id,name,status,total_volumes').single():await supabase.from('rc_series').insert(payload).select('id,name,status,total_volumes').single()
  if(error)setError(error.message);else setMetadata(prev=>[...prev.filter(m=>m.id!==data.id),data])
  setSaving('')
 }
 const grouped=books.filter(b=>b.series_name?.trim()).reduce((acc,b)=>{const key=b.series_name.trim().toLocaleLowerCase();if(!acc[key])acc[key]={name:b.series_name.trim(),items:[]};acc[key].items.push(b);return acc},{})
 const groups=Object.values(grouped).sort((a,b)=>a.name.localeCompare(b.name))
 const visibleGroups=groups.filter(g=>{const meta=metadata.find(m=>m.name.toLocaleLowerCase()===g.name.toLocaleLowerCase());const numbers=g.items.filter(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number!=null).map(b=>Number(b.series_number));const duplicates=numbers.some((n,i)=>numbers.indexOf(n)!==i);const missing=meta?.total_volumes!=null&&meta.total_volumes<=500&&Array.from({length:meta.total_volumes},(_,i)=>i+1).some(n=>!numbers.includes(n));const warnings=duplicates||missing||g.items.some(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&(b.series_number==null||!Number.isInteger(Number(b.series_number))||Number(b.series_number)<1))||g.items.some(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&meta?.total_volumes!=null&&b.series_number!=null&&Number(b.series_number)>meta.total_volumes);return g.name.toLocaleLowerCase().includes(seriesQuery.trim().toLocaleLowerCase())&&(seriesFilter==='all'||(meta?.status||'ongoing')===seriesFilter)&&(!showSeriesWarningsOnly||warnings)}).sort((a,b)=>seriesSort==='unread'?b.items.filter(x=>x.status==='to_read').length-a.items.filter(x=>x.status==='to_read').length||a.name.localeCompare(b.name):seriesSort==='finished'?b.items.filter(x=>x.status==='finished').length-a.items.filter(x=>x.status==='finished').length||a.name.localeCompare(b.name):a.name.localeCompare(b.name))
 if(!groups.length)return <section className="hero"><h2>Your series</h2><p>Add a series name and optional volume number to a book to start tracking your series.</p></section>
 return <section className="seriesShelf"><div className="hero"><h2>Your series</h2><p>{groups.length} series in your library. Volumes are ordered by number when known; missing volumes are not invented.</p></div>
 <div className="seriesToolbar"><label>Find a series<input value={seriesQuery} onChange={e=>setSeriesQuery(e.target.value)} placeholder="Search series…" /></label><label>Publication status<select value={seriesFilter} onChange={e=>setSeriesFilter(e.target.value)}><option value="all">All series</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="abandoned">Abandoned</option></select></label><label>Sort by<select value={seriesSort} onChange={e=>setSeriesSort(e.target.value)}><option value="name">Name A–Z</option><option value="unread">Most unread</option><option value="finished">Most finished</option></select></label><label className="seriesWarningToggle"><input type="checkbox" checked={showSeriesWarningsOnly} onChange={e=>setShowSeriesWarningsOnly(e.target.checked)}/>Needs review only</label><span>{visibleGroups.length} / {groups.length} series</span></div>{!visibleGroups.length&&<p>No series match your filters.</p>}<div className="seriesGrid">{visibleGroups.map(group=>{
  const ordered=[...group.items].sort((a,b)=>(a.series_number??Number.POSITIVE_INFINITY)-(b.series_number??Number.POSITIVE_INFINITY)||a.title.localeCompare(b.title))
  const mainUnread=ordered.filter(b=>b.status==='to_read'&&b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus')
  const numberedUnread=mainUnread.filter(b=>b.series_number!=null&&Number.isInteger(Number(b.series_number))&&Number(b.series_number)>=1)
  const next=numberedUnread[0]||mainUnread[0]
  const nextNumber=next?.series_number==null?null:Number(next.series_number)
  const earlierUnknown=nextNumber!=null&&mainUnread.some(b=>b.series_number==null||!Number.isInteger(Number(b.series_number)))
  const earlierUnread=nextNumber!=null&&mainUnread.some(b=>b.series_number!=null&&Number(b.series_number)<nextNumber)
  const priorMissing=nextNumber!=null&&Number.isInteger(nextNumber)&&nextNumber>1&&nextNumber<=501&&Array.from({length:nextNumber-1},(_,i)=>i+1).some(n=>!ordered.some(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&Number(b.series_number)===n))
  const nextUncertain=nextNumber==null||!Number.isInteger(nextNumber)||nextNumber>501||earlierUnknown||earlierUnread||priorMissing
  const meta=metadata.find(m=>m.name.toLocaleLowerCase()===group.name.toLocaleLowerCase())
  const numbered=ordered.filter(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number!=null)
  const duplicates=[...new Set(numbered.filter((b,i)=>numbered.some((other,j)=>j!==i&&Number(other.series_number)===Number(b.series_number))).map(b=>Number(b.series_number)))]
  const mainVolumes=new Set(numbered.filter(b=>Number.isInteger(Number(b.series_number))&&Number(b.series_number)>=1).map(b=>Number(b.series_number)))
  const invalidMainNumbers=numbered.filter(b=>!Number.isInteger(Number(b.series_number))||Number(b.series_number)<1)
  const beyondTotal=meta?.total_volumes!=null?numbered.filter(b=>Number.isInteger(Number(b.series_number))&&Number(b.series_number)>meta.total_volumes):[]
  const missing=meta?.total_volumes!=null&&meta.total_volumes<=500?Array.from({length:meta.total_volumes},(_,i)=>i+1).filter(n=>!mainVolumes.has(n)):[]
  const mainBooks=numbered.filter(b=>Number.isInteger(Number(b.series_number))&&Number(b.series_number)>=1&&Number(b.series_number)<=(meta?.total_volumes??0))
  const finishedMainNumbers=new Set(mainBooks.filter(b=>b.status==='finished').map(b=>Number(b.series_number)))
  const completedMainCount=finishedMainNumbers.size
  const recordedComplete=meta?.total_volumes!=null&&meta.total_volumes<=500&&missing.length===0&&duplicates.length===0&&invalidMainNumbers.length===0&&beyondTotal.length===0&&mainBooks.length===meta.total_volumes&&completedMainCount===meta.total_volumes
  const extrasCount=ordered.filter(b=>b.series_volume_kind==='extra').length
  const omnibusCount=ordered.filter(b=>b.series_volume_kind==='omnibus').length
  return <article key={group.name} className="seriesCard"><h3>{group.name}</h3><form className="seriesSettings" onSubmit={e=>{e.preventDefault();saveSeries(group,e.currentTarget.elements.seriesStatus.value,e.currentTarget.elements.totalVolumes.value)}}><label>Series status<select name="seriesStatus" key={meta?.status||'ongoing'} defaultValue={meta?.status||'ongoing'}><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="abandoned">Abandoned</option></select></label><label>Total volumes (optional)<input name="totalVolumes" key={String(meta?.total_volumes??'')} type="number" min="1" step="1" defaultValue={meta?.total_volumes??''}/></label><button disabled={saving===group.name}>Save series</button></form><p>{ordered.filter(b=>b.status==='finished').length} finished · {ordered.length} recorded{extrasCount?' · '+extrasCount+' extras':''}{omnibusCount?' · '+omnibusCount+' omnibus editions':''}{meta?.total_volumes!=null?' · '+meta.total_volumes+' stated main volumes':''}</p>
   {meta?.total_volumes!=null&&<div className="seriesProgress"><div className="seriesProgressTrack" role="progressbar" aria-label={'Unique finished numbered main volumes in '+group.name} aria-valuemin="0" aria-valuemax={meta.total_volumes} aria-valuenow={completedMainCount}><span style={{width:Math.min(100,100*completedMainCount/meta.total_volumes)+'%'}}/></div><small>{completedMainCount} distinct numbered main volumes finished / {meta.total_volumes} stated volumes</small></div>}
   {meta?.total_volumes!=null&&mainVolumes.size<meta.total_volumes&&<p className="seriesCaution">The numbered main-volume collection may be incomplete. Extras and unnumbered books do not fill missing main-volume slots.</p>}
   {meta?.total_volumes!=null&&ordered.length>meta.total_volumes&&<p className="seriesCaution">Your library contains more records than the stated number of main volumes; extras and collected editions are tracked separately.</p>}
   {ordered.some(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number==null)&&<p className="seriesCaution">Some main volumes have no number; reading order may be incomplete.</p>}
   {invalidMainNumbers.length>0&&<p className="seriesCaution">{invalidMainNumbers.length} main volume(s) have fractional or invalid numbers. Mark novellas as extras, or use whole numbers for main volumes.</p>}
   {beyondTotal.length>0&&<p className="seriesCaution">{beyondTotal.length} main volume(s) are numbered above the stated total of {meta.total_volumes}. Check the series total or reclassify extras.</p>}
   {duplicates.length>0&&<p className="seriesCaution">Repeated volume numbers: {duplicates.sort((a,b)=>a-b).join(', ')}. Check for duplicate entries or editions.</p>}
   {missing.length>0&&<p className="seriesCaution">Missing numbered volumes in your library: {missing.slice(0,18).join(', ')}{missing.length>18?' … ('+missing.length+' total)':''}. This assumes main volumes are numbered 1 through {meta.total_volumes}; special editions may differ.</p>}
   {meta?.total_volumes!=null&&meta.total_volumes>500&&<p className="seriesCaution">Volume gap detection is limited to series of 500 volumes or fewer.</p>}
   {meta?.status==='completed'&&<p className="seriesCaution">Publication complete (manually set) · {recordedComplete?'all numbered main volumes are recorded and marked finished':'your recorded reading may still be incomplete'}.</p>}
   {recordedComplete&&<p className="seriesCompletion">All stated numbered main volumes are recorded and marked finished. Extras are tracked separately.</p>}
   <button className="subtle" onClick={()=>onViewLibrary(group.name)}>Browse these books in Library</button><ol>{ordered.map(b=><li key={b.id}><span>{b.series_number!=null?'#'+b.series_number+' · ':''}{b.title} <small className={"volumeKind volumeKind-"+(b.series_volume_kind||"main")}>{b.series_volume_kind==="extra"?"Novella / extra":b.series_volume_kind==="omnibus"?"Omnibus":"Main volume"}</small></span><small>{b.status==='finished'?'Finished':b.status==='reading'?'Reading':b.status==='dnf'?'DNF':'To Read'}</small><button className="subtle" onClick={()=>onEdit(b)}>Edit</button></li>)}</ol>
   {next&&<div className="seriesNext"><span>Next recorded unread volume: <strong>{next.title}</strong>{nextUncertain&&<small> · Check the volume order before starting.</small>}</span><button onClick={()=>onStart(next)}>Start reading</button></div>}
  </article>
 })}</div></section>
}

function StoryGraphImport({books,onImport,busy}){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[name,setName]=useState(''),[includeDates,setIncludeDates]=useState(true),[confirmImport,setConfirmImport]=useState(false)
 const key=x=>[x.title,x.author].map(v=>(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase()).join('|')
 const hasId=x=>!!(x.isbn_13||x.isbn_10)
 const seen=[]
 const preview=items.map(x=>{
  const matches=b=>(x.isbn_13&&b.isbn_13===x.isbn_13)||(x.isbn_10&&b.isbn_10===x.isbn_10)||(key(b)===key(x)&&(!hasId(x)||!hasId(b)))
  const duplicate=books.some(matches)||seen.some(matches)
  if(!duplicate)seen.push(x)
  return {...x,duplicate:!!duplicate}
 })
 const eligible=preview.filter(x=>!x.duplicate&&x.status&&x.warnings.length===0)
 const needsReview=preview.filter(x=>!x.duplicate&&(!x.status||x.warnings.length>0))
 const datedSessionCount=eligible.reduce((sum,x)=>sum+(x.sessions?.length||0),0)
 const excludedCount=preview.length-eligible.length
 const incompleteRereads=preview.filter(x=>!x.duplicate&&x.status==='finished'&&x.read_count>1&&x.read_count>(x.sessions?.length||0))
 const importWithoutDates=eligible.filter(x=>x.status==='finished'&&!x.finished_on).length
 const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d}
 function edit(row,field,value){
  setItems(current=>current.map(x=>{
   if(x.row!==row)return x
   const next={...x}
   if(field==='status'){next.raw_status=value;next.status=value||null}
   if(field==='pages'){next.raw_pages=value;next.pages=value===''?null:Number(value)}
   if(field==='finished_on'){next.raw_date=value;next.finished_on=value||null;next.sessions=(next.sessions||[]).filter(s=>s.started_on!==null);if(next.status==='finished'&&validDate(value)&&!next.sessions.some(s=>s.finished_on===value))next.sessions=[...next.sessions,{started_on:null,finished_on:value}]}
   if(field==='rating'){next.raw_rating=value;next.rating=value===''?null:Number(value)}
   if(field==='reviewsRereads')next.reviewsRereads=value
   if(field==='reviewsSessions')next.reviewsSessions=value
   const warnings=[]
   if(!next.status)warnings.push('Unrecognized reading status')
   if(next.raw_pages!==''&&(next.pages===null||!Number.isInteger(next.pages)||next.pages<1||next.pages>100000))warnings.push('Invalid page count')
   if(next.raw_date&&!validDate(next.raw_date))warnings.push('Invalid finish date')
   if(next.status==='finished'&&!next.raw_date)warnings.push('Missing finish date (needed for yearly statistics)')
   if(next.status==='finished'&&next.sessionParseIssues&&!next.reviewsSessions)warnings.push('Unrecognized reading session dates')
   if(next.status==='finished'&&next.sessionDuplicates&&!next.reviewsSessions)warnings.push('Duplicate reading sessions in CSV: review before import')
   if(next.status==='finished'&&next.read_count>1&&next.read_count>(next.sessions||[]).length&&!next.reviewsRereads)warnings.push('Some reading sessions have no dates')
   if(next.status==='finished'&&next.dates_read){const rawParts=next.dates_read.split(',').map(s=>s.trim()).filter(Boolean);if(rawParts.length>(next.sessions||[]).length&&!next.reviewsRereads)warnings.push('Reading session dates need review')}
   if(next.raw_rating!==''&&(next.rating===null||!Number.isInteger(next.rating)||next.rating<1||next.rating>5))warnings.push('Rating not a whole star (1–5)')
   next.finished_on=next.status==='finished'&&validDate(next.raw_date)?next.raw_date:null
   next.rating=next.status==='finished'&&next.raw_rating!==''&&Number.isInteger(Number(next.raw_rating))&&Number(next.raw_rating)>=1&&Number(next.raw_rating)<=5?Number(next.raw_rating):null
   next.warnings=warnings
   return next
  }))
 }
 async function choose(e){
  const file=e.target.files?.[0];setItems([]);setError('');setName('');setConfirmImport(false)
  if(!file)return
  if(file.size>10*1024*1024){setError('CSV exceeds the 10 MB limit.');return}
  try{const parsed=parseStoryGraphCSV(await file.text());if(parsed.length>10000)throw new Error('Maximum 10,000 books per file.');setItems(parsed);setName(file.name)}
  catch(err){setError(err.message||'Could not read CSV.')}
 }
 return <section className="storygraphImport"><h2>Import from StoryGraph</h2><p>Export your reading data as CSV from StoryGraph, then preview it here. The file is parsed on your device; only confirmed books are sent to your library.</p><label>StoryGraph CSV file<input type="file" accept=".csv,text/csv" onChange={choose} disabled={busy}/></label>{error&&<p role="alert">{error}</p>}{items.length>0&&<><p><strong>{name}</strong> · {items.length} books found · {eligible.length} ready · {excludedCount} excluded · {datedSessionCount} dated reading sessions · {incompleteRereads.length} incomplete reread histories · {preview.filter(x=>x.duplicate).length} duplicates · {needsReview.length} need review</p><label className="importOption"><input type="checkbox" checked={includeDates} onChange={e=>{setIncludeDates(e.target.checked);setConfirmImport(false)}}/> Import finish dates and whole-star ratings when available</label><p>Correct excluded rows below. Fractional ratings are not rounded automatically. Formats and series details are not guessed. Some rereads have fewer dated sessions than the StoryGraph read count: missing sessions cannot be reconstructed. Preview shows the first 20 rows.</p>{needsReview.length>0&&<details className="importIssues" open><summary>Review and correct {needsReview.length} excluded rows</summary><div className="importPreview">{needsReview.slice(0,100).map(x=><div className="importCorrection" key={x.row}><strong>Row {x.row}: {x.title}</strong>{x.read_count>1&&<p>Read count: {x.read_count}. Dates: {x.dates_read||'not supplied'}. {x.sessions?.length||0} dated session(s) available for import; missing sessions cannot be reconstructed.</p>}<p role="status">{x.warnings.join('; ')}</p><div className="importCorrectionFields"><label>Status<select value={x.status||''} onChange={e=>edit(x.row,'status',e.target.value)} disabled={busy}><option value="">Select status</option><option value="to_read">To Read</option><option value="reading">Currently Reading</option><option value="finished">Finished</option><option value="dnf">DNF</option></select></label><label>Pages<input type="number" min="1" max="100000" value={x.raw_pages??''} onChange={e=>edit(x.row,'pages',e.target.value)} disabled={busy}/></label><label>Finish date (YYYY-MM-DD)<input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" value={x.raw_date??''} onChange={e=>edit(x.row,'finished_on',e.target.value)} disabled={busy}/></label><label>Rating (whole stars)<input type="number" min="1" max="5" step="1" value={x.raw_rating??''} onChange={e=>edit(x.row,'rating',e.target.value)} disabled={busy}/></label>{x.read_count>1&&<label><input type="checkbox" checked={!!x.reviewsRereads} onChange={e=>edit(x.row,'reviewsRereads',e.target.checked)} disabled={busy}/> Import available dated sessions; acknowledge missing sessions</label>}{(x.sessionParseIssues||x.sessionDuplicates)&&<label><input type="checkbox" checked={!!x.reviewsSessions} onChange={e=>edit(x.row,'reviewsSessions',e.target.checked)} disabled={busy}/> I checked the dates: import only the valid, distinct sessions and omit unrecognized or repeated periods</label>}</div></div>)}{needsReview.length>100&&<p>Showing the first 100 issues.</p>}</div></details>}<div className="importPreview">{preview.slice(0,20).map(x=><div key={x.row}><strong>{x.title}</strong> — {x.author||'Unknown author'} <small>({x.status||'unknown status'}{x.duplicate?', duplicate':''}{x.warnings.length?', '+x.warnings.join('; '):''})</small></div>)}</div><p>{includeDates?datedSessionCount:0} dated sessions will be imported. {importWithoutDates} finished books have no finish date in the ready selection.</p><label className="importOption"><input type="checkbox" checked={confirmImport} onChange={e=>setConfirmImport(e.target.checked)} disabled={busy}/> I reviewed the preview and understand excluded rows will not be imported.</label><button disabled={busy||!eligible.length||!confirmImport} onClick={async()=>{const ok=await onImport(eligible,includeDates);if(ok){setItems([]);setName('');setConfirmImport(false)}}}>{busy?'Importing…':'Import '+eligible.length+' new books'}</button></>}</section>
}
function BookCatalogSearch({books,onAdd,busy}){
 const [term,setTerm]=useState(''),[mode,setMode]=useState('all'),[results,setResults]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false)
 const [selected,setSelected]=useState(null)
 const [pending,setPending]=useState(null)
 const [pendingTitle,setPendingTitle]=useState(''),[pendingAuthor,setPendingAuthor]=useState(''),[pendingPages,setPendingPages]=useState('')
 const [pendingSeries,setPendingSeries]=useState(''),[pendingVolume,setPendingVolume]=useState('')
 const requestRef=useRef(0)
 const [language,setLanguage]=useState('all')
 async function search(e,offset=0){
  if(e?.preventDefault)e.preventDefault()
  const q=term.trim();if(q.length<2)return
  const requestId=++requestRef.current
  setLoading(true);setError('')
  if(offset===0){setSearched(false);setResults([]);setPage(0);setSelected(null)}
  try{
   const normalized=q.replace(/[^0-9Xx]/g,'')
   const isbn=/^(?:[0-9]{13}|[0-9]{9}[0-9Xx])$/.test(normalized)?normalized:null
   const query=isbn?'isbn:'+isbn:mode==='title'?'intitle:'+q:mode==='author'?'inauthor:'+q:q
   let items=[],total=0,source='Google Books'
   try{
    const response=await fetch('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(query)+'&startIndex='+offset+'&maxResults=20&printType=books'+(language!=='all'?'&langRestrict='+language:''))
    if(!response.ok)throw new Error('Google Books HTTP '+response.status)
    const data=await response.json()
    total=data.totalItems||0
    items=(data.items||[]).filter(x=>x.volumeInfo?.title).map(x=>({id:x.id,source:'google_books',title:x.volumeInfo.title,author:(x.volumeInfo.authors||[]).join(', '),pages:x.volumeInfo.pageCount||null,cover:x.volumeInfo.imageLinks?.thumbnail?.replace('http:','https:')||null,published:x.volumeInfo.publishedDate||'',publisher:x.volumeInfo.publisher||'',language:x.volumeInfo.language||'',isbn:(x.volumeInfo.industryIdentifiers||[]).find(v=>v.type==='ISBN_13')?.identifier||'',isbn10:(x.volumeInfo.industryIdentifiers||[]).find(v=>v.type==='ISBN_10')?.identifier||'',description:x.volumeInfo.description||''}))
   }catch(googleError){
    source='Open Library'
    const params=new URLSearchParams({limit:'20',offset:String(offset),fields:'key,title,author_name,cover_i,first_publish_year,isbn,language,number_of_pages_median,edition_key'})
    if(isbn)params.set('q','isbn:'+isbn)
    else if(mode==='title')params.set('title',q)
    else if(mode==='author')params.set('author',q)
    else params.set('q',q)
    if(language!=='all')params.set('lang',language)
    const response=await fetch('https://openlibrary.org/search.json?'+params.toString())
    if(!response.ok)throw new Error('Both book catalogs are temporarily unavailable. Please try again later.')
    const data=await response.json()
    total=data.numFound||data.num_found||0
    items=(data.docs||[]).filter(x=>x.title).map(x=>({id:'ol:'+x.key,source:'open_library',title:x.title,author:(x.author_name||[]).join(', '),pages:x.number_of_pages_median||null,cover:x.cover_i?'https://covers.openlibrary.org/b/id/'+x.cover_i+'-M.jpg':null,published:x.first_publish_year?String(x.first_publish_year):'',publisher:'',language:(x.language||[])[0]||'',isbn:(x.isbn||[]).find(v=>v.length===13)||'',isbn10:(x.isbn||[]).find(v=>v.length===10)||'',description:'',series:'',series_position:null}))
   }
   if(requestId!==requestRef.current)return
   setError(source==='Open Library'?'Google Books is unavailable; showing Open Library results instead.':'')
   setResults(previous=>offset===0?items:[...previous,...items.filter(x=>!previous.some(p=>p.id===x.id))])
   setPage(offset);setHasMore((data.items||[]).length===20&&offset+20<total&&offset+20<200)
   setSearched(true)
  }catch(err){if(requestId===requestRef.current)setError(err.message||'Search failed. Please try again.')}finally{if(requestId===requestRef.current)setLoading(false)}
 }
 function prepare(b){setPending(b);setPendingTitle(b.title);setPendingAuthor(b.author);setPendingPages(b.pages?String(b.pages):'');setPendingSeries('');setPendingVolume('')}
 const sameTitle=b=>books.filter(x=>x.title.trim().toLocaleLowerCase()===b.title.trim().toLocaleLowerCase()&&x.author.trim().toLocaleLowerCase()===b.author.trim().toLocaleLowerCase())
 const exists=b=>books.some(x=>(b.id&&b.source!=='open_library'&&x.catalog_source==='google_books'&&x.catalog_volume_id===b.id)||(b.isbn&&x.isbn_13===b.isbn)||(b.isbn10&&x.isbn_10===b.isbn10)||(!x.catalog_volume_id&&!x.isbn_13&&!x.isbn_10&&x.title.trim().toLocaleLowerCase()===b.title.trim().toLocaleLowerCase()&&x.author.trim().toLocaleLowerCase()===b.author.trim().toLocaleLowerCase()))
 return <section className="catalogSearch"><h2>Find a book</h2><p>Search Google Books with Open Library as a fallback. Check the edition before adding it to your library.</p><form onSubmit={e=>search(e,0)} className="catalogSearchForm"><input aria-label="Search book catalog" placeholder="Title, author or ISBN" value={term} onChange={e=>{setTerm(e.target.value);setHasMore(false)}} minLength="2" required/><select aria-label="Search by" value={mode} onChange={e=>{setMode(e.target.value);setHasMore(false)}}><option value="all">All fields</option><option value="title">Title</option><option value="author">Author</option></select><select aria-label="Catalog language" value={language} onChange={e=>{setLanguage(e.target.value);setHasMore(false)}}><option value="all">All languages</option><option value="en">English</option><option value="fr">French</option></select><button disabled={loading}>{loading?'Searching…':'Search books'}</button></form>{error&&<p role="alert">{error}</p>}{searched&&!results.length&&<p>No results found. You can add the book manually below.</p>}{results.length>0&&<p>{results.length} results loaded · Editions may differ in page count, language and publication date.</p>}<div className="catalogResults">{results.map(b=><article className="catalogResult" key={b.id}>{b.cover&&<img src={b.cover} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<div><strong>{b.title}</strong><p>{b.author||'Author not listed'}</p><small>{b.source==='open_library'?'Open Library · ':'Google Books · '}</small><small>{[b.published,b.publisher,b.language?.toUpperCase(),b.pages?b.pages+' pages':null,b.isbn?'ISBN '+b.isbn:null].filter(Boolean).join(' · ')}</small><p><button type="button" className="subtle" onClick={()=>setSelected(selected?.id===b.id?null:b)} aria-expanded={selected?.id===b.id}> {selected?.id===b.id?'Hide details':'View details'}</button></p>{selected?.id===b.id&&<div className="catalogDetails"><p>{b.description?b.description.replace(/<[^>]*>/g,' ').slice(0,1800):'No description provided by the catalog.'}</p><small>Catalog information may be incomplete. Format and series position are not inferred automatically.</small></div>}</div><button type="button" disabled={busy||exists(b)} onClick={()=>prepare(b)}>{exists(b)?'In library':'Choose edition'}</button></article>)}</div>{pending&&<div className="catalogConfirm" role="region" aria-label="Confirm book edition"><h3>Review before adding</h3><p>Catalog details can be inaccurate. Confirm the title, author and page count for your edition.</p><form onSubmit={async e=>{e.preventDefault();const saved=await onAdd({...pending,title:pendingTitle.trim(),author:pendingAuthor.trim(),pages:pendingPages===''?null:Number(pendingPages),series_name:pendingSeries.trim()||null,series_number:pendingSeries.trim()&&pendingVolume!==''?Number(pendingVolume):null});if(saved)setPending(null)}}><label>Title<input required value={pendingTitle} onChange={e=>setPendingTitle(e.target.value)}/></label><label>Author<input value={pendingAuthor} onChange={e=>setPendingAuthor(e.target.value)}/></label><label>Pages (optional)<input type="number" min="1" max="100000" step="1" value={pendingPages} onChange={e=>setPendingPages(e.target.value)}/></label><label>Series (optional)<input value={pendingSeries} onChange={e=>setPendingSeries(e.target.value)} placeholder="Series name"/></label><label>Volume number (optional)<input type="number" min="0.1" step="0.1" value={pendingVolume} onChange={e=>setPendingVolume(e.target.value)} disabled={!pendingSeries.trim()}/></label><small>Confirm series and volume using the edition or publisher. Catalog results may not identify series reliably.</small>{sameTitle({title:pendingTitle,author:pendingAuthor}).length>0&&!exists({...pending,title:pendingTitle,author:pendingAuthor})&&<p role="status">You already have another edition of this title. Check the ISBN before adding this one.</p>}<div className="catalogConfirmActions"><button type="button" className="secondary" onClick={()=>setPending(null)}>Cancel</button><button disabled={busy||!pendingTitle.trim()||exists({title:pendingTitle,author:pendingAuthor})}>Add this edition</button></div></form>{exists({title:pendingTitle,author:pendingAuthor})&&<p role="status">This edition or an unverified copy of this title is already in your library.</p>}</div>}{hasMore&&<button type="button" className="secondary" disabled={loading} onClick={()=>search(null,page+20)}>{loading?'Loading…':'Load more books'}</button>}</section>
}
function App(){
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('')
 const [editing,setEditing]=useState(null),[draft,setDraft]=useState(null),[showLibraryTools,setShowLibraryTools]=useState(false)
 const [journalBook,setJournalBook]=useState(null),[journalDraft,setJournalDraft]=useState(null),[readingSessions,setReadingSessions]=useState([]),[quotes,setQuotes]=useState([])
 const [sessionEdit,setSessionEdit]=useState(null),[sessionStart,setSessionStart]=useState(''),[sessionFinish,setSessionFinish]=useState(''),[quoteText,setQuoteText]=useState('')
 const [tbrSeriesSafe,setTbrSeriesSafe]=useState(false),[tbrMode,setTbrMode]=useState('all'),[tbrMaxPages,setTbrMaxPages]=useState(''),[tbrMinPages,setTbrMinPages]=useState(''),[tbrAuthor,setTbrAuthor]=useState(''),[tbrFormat,setTbrFormat]=useState('all'),[tab,setTab]=useState('Home'),[books,setBooks]=useState([]),[title,setTitle]=useState(''),[author,setAuthor]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[dark,setDark]=useState(false),[libraryStatus,setLibraryStatus]=useState('all'),[librarySort,setLibrarySort]=useState('recent'),[nextPick,setNextPick]=useState(null)
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return ()=>subscription.unsubscribe()},[])
 async function load(){if(!session)return;const {data:sessionRows,error:sessionError}=await supabase.from('rc_reading_sessions').select('id,book_id,started_on,finished_on').order('finished_on',{ascending:false});if(sessionError)setMessage(sessionError.message);else setReadingSessions(sessionRows||[]);const {data,error}=await supabase.from('rc_books').select('id,title,author,status,updated_at,page_count,current_page,progress_percent,progress_mode,book_format,started_on,finished_on,rating,review,favorite,series_name,series_number,series_volume_kind,catalog_source,catalog_volume_id,isbn_13,isbn_10,release_on,release_alert_enabled').order('created_at',{ascending:false});if(error)setMessage(error.message);else setBooks(data)}
 useEffect(()=>{if(session)load();else{setBooks([]);setReadingSessions([])}},[session?.user?.id])
 useEffect(()=>{const onFocus=()=>{if(session)load()};const onVisible=()=>{if(document.visibilityState==='visible'&&session)load()};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[session])
 async function auth(mode){setBusy(true);setMessage('');const {error}=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});setBusy(false);setMessage(error?error.message:mode==='signup'?'Account created. Check your email if confirmation is required.':'')}
 async function importStoryGraph(items,includeDates){
  if(!session?.user?.id)return false
  setBusy(true);setMessage('')
  try{
   const payload=items.map(b=>({
    title:b.title,author:b.author||'',status:b.status,page_count:b.pages,
    isbn_13:b.isbn_13,isbn_10:b.isbn_10,
    finished_on:includeDates?b.finished_on:null,rating:includeDates?b.rating:null,
    sessions:includeDates?(b.sessions||[]):[]
   }))
   const {data,error}=await supabase.rpc('rc_import_storygraph',{p_books:payload})
   if(error)throw error
   setMessage('Import complete: '+data.books+' books and '+data.sessions+' reading sessions added; '+data.skipped+' existing books skipped. All changes were saved together.')
   await load()
   return true
  }catch(err){
   setMessage('Import cancelled without partial changes: '+(err.message||'Unknown error')+'. Check the CSV and try again.')
   return false
  }finally{setBusy(false)}
 }
 async function saveReleaseReminder(book,payload){
  if(!book||book.status!=='to_read')return false
  const {error}=await supabase.from('rc_books').update(payload).eq('id',book.id).eq('user_id',session.user.id)
  if(error){setMessage(error.message);return false}
  await load();return true
 }
 async function addCatalogBook(book){
  const normalize=value=>(value||'').trim().toLocaleLowerCase()
  if(book.pages!=null&&(!Number.isInteger(book.pages)||book.pages<1||book.pages>100000)){setMessage('Page count must be a whole number between 1 and 100000.');return false}
  const duplicate=books.some(b=>(book.id&&book.source!=='open_library'&&b.catalog_source==='google_books'&&b.catalog_volume_id===book.id)||(book.isbn&&b.isbn_13===book.isbn)||(book.isbn10&&b.isbn_10===book.isbn10)||(!b.catalog_volume_id&&!b.isbn_13&&!b.isbn_10&&normalize(b.title)===normalize(book.title)&&normalize(b.author)===normalize(book.author)))
  if(duplicate){setMessage('This edition or an unverified copy of this title is already in your library.');return false}
  setBusy(true);setMessage('')
  const {error}=await supabase.from('rc_books').insert({title:book.title.trim(),author:book.author.trim(),page_count:book.pages&&Number.isInteger(book.pages)?book.pages:null,user_id:session.user.id,catalog_source:book.source==='open_library'?null:'google_books',catalog_volume_id:book.source==='open_library'?null:book.id,isbn_13:book.isbn||null,isbn_10:book.isbn10||null,series_name:book.series_name||null,series_number:book.series_number||null})
  setBusy(false)
  if(error){setMessage(error.message);return false}
  setMessage('Added '+book.title+' to your library.');await load();return true
 }
 async function add(e){e.preventDefault();if(!title.trim())return;const normalize=v=>(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();if(books.some(b=>normalize(b.title)===normalize(title)&&normalize(b.author)===normalize(author))&&!window.confirm('A book with the same title and author already exists. Add another edition anyway?'))return;setBusy(true);const {error}=await supabase.from('rc_books').insert({title:title.trim(),author:author.trim(),user_id:session.user.id});setBusy(false);if(error)setMessage(error.message);else{setTitle('');setAuthor('');await load()}}
 async function change(book,status){
  if(book.status===status)return
  if((status==='to_read'||status==='dnf')&&readingSessions.some(s=>s.book_id===book.id)){setMessage('This book has completed reading sessions. Remove those sessions in the journal before changing its status to To Read or DNF.');return}
  const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')
  const payload={status}
  if(status==='to_read'&&(book.started_on||book.finished_on)){
   if(!confirm('Move this book back to To Read and clear its reading dates?'))return
   payload.started_on=null;payload.finished_on=null
  }
  if(status==='reading'&&!book.started_on)payload.started_on=today
  if(status==='reading'&&book.status==='finished'&&book.finished_on){payload.finished_on=null}
  if(status==='finished'){
   if(!book.started_on)payload.started_on=today
   if(!book.finished_on)payload.finished_on=today
  }else if(status!=='to_read'&&status!=='reading'&&book.status==='finished'&&book.finished_on){
   const confirmed=confirm('This book has a finish date. Keep the finish date when changing its status? Select Cancel to clear it.')
   if(!confirmed)payload.finished_on=null
  }
  if(payload.finished_on&&book.started_on&&payload.finished_on<book.started_on){setMessage('The finish date cannot be earlier than the existing start date. Edit the journal dates first.');return}
  const {data,error}=await supabase.from('rc_books').update(payload).eq('id',book.id).eq('updated_at',book.updated_at).select('id')
  if(error)setMessage(error.message);else if(!data?.length)setMessage('This book changed on another device. Sync and try again.');else if(status==='reading'&&book.status==='finished'&&book.finished_on)setMessage('Reading restarted. The previous finish date was cleared.');await load()
 }
 function openEditor(book){setEditing(book.id);setDraft({...book})}
 function viewSeriesInLibrary(name){setTab('Library');setLibraryStatus('all');setQuery(name)}
 function safeSeriesCandidate(book){if(!book.series_name?.trim())return true;if(book.series_volume_kind==='extra'||book.series_volume_kind==='omnibus')return false;const members=books.filter(b=>b.series_name?.trim().toLocaleLowerCase()===book.series_name.trim().toLocaleLowerCase());const number=Number(book.series_number);if(book.series_number==null||!Number.isInteger(number)||number<1)return false;const prior=members.filter(b=>b.series_volume_kind!=='extra'&&b.series_volume_kind!=='omnibus'&&b.series_number!=null&&Number.isInteger(Number(b.series_number))&&Number(b.series_number)<number);if(number>501||prior.some(b=>b.status!=='finished'))return false;return Array.from({length:number-1},(_,i)=>i+1).every(n=>prior.some(b=>Number(b.series_number)===n&&b.status==='finished'))}
 const tbrEligible=books.filter(b=>b.status==='to_read'&&(tbrMode!=='standalone'||!b.series_name?.trim())&&(tbrMode!=='series'||b.series_name?.trim())&&(tbrMaxPages===''||(b.page_count!=null&&Number(b.page_count)<=Number(tbrMaxPages)))&&(tbrMinPages===''||(b.page_count!=null&&Number(b.page_count)>=Number(tbrMinPages)))&&(tbrAuthor===''||(b.author||'').toLocaleLowerCase().includes(tbrAuthor.trim().toLocaleLowerCase()))&&(tbrFormat==='all'||b.book_format===tbrFormat)&&(!tbrSeriesSafe||safeSeriesCandidate(b)))
 async function saveBook(e){
  e.preventDefault()
  if(!draft?.title?.trim())return
  const pageCount=draft.page_count===''||draft.page_count==null?null:Number(draft.page_count)
  const page=Number(draft.current_page)||0
  const percent=Number(draft.progress_percent)||0
  if(pageCount!==null&&(!Number.isInteger(pageCount)||pageCount<1)){setMessage('Page count must be a positive whole number.');return}
  if(draft.progress_mode==='page'&&pageCount===null){setMessage('Enter a page count to track pages, or select percent.');return}
  if(!Number.isInteger(page)||!Number.isInteger(percent)||page<0||(pageCount!==null&&page>pageCount)||percent<0||percent>100){setMessage('Check your progress values. Use whole numbers for pages and percent.');return}
  if(draft.series_name?.trim()&&draft.series_number!==''&&draft.series_number!=null&&(!Number.isFinite(Number(draft.series_number))||Number(draft.series_number)<=0)){setMessage('Series volume must be a positive number.');return}
  setBusy(true)
  const payload={title:draft.title.trim(),author:draft.author.trim(),series_name:draft.series_name?.trim()||null,series_number:draft.series_name?.trim()&&draft.series_number!==''&&draft.series_number!=null?Number(draft.series_number):null,series_volume_kind:draft.series_name?.trim()?(draft.series_volume_kind||'main'):'main',book_format:draft.book_format||null,page_count:pageCount,current_page:page,progress_percent:percent,progress_mode:draft.progress_mode}
  const {data,error}=await supabase.from('rc_books').update(payload).eq('id',draft.id).eq('updated_at',draft.updated_at).select('id')
  setBusy(false)
  if(error)setMessage(error.message)
  else if(!data?.length)setMessage('This book was changed on another device. Your changes were not saved. Sync and reopen it.')
  else{setEditing(null);setDraft(null)}
  await load()
 }
 function openJournal(book){setJournalBook(book.id);setJournalDraft({...book});setQuoteText('');setSessionEdit(null);setSessionStart('');setSessionFinish('');loadQuotes(book.id)}
 async function loadQuotes(bookId){const {data,error}=await supabase.from('rc_quotes').select('id,quote,created_at').eq('book_id',bookId).order('created_at',{ascending:false});if(error)setMessage(error.message);else setQuotes(data)}
 async function saveReadingSession(e){
  e.preventDefault()
  if(!sessionFinish){setMessage('A finish date is required for a completed reading.');return}
  const todayLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
  if(readingSessions.some(s=>s.book_id===journalBook&&s.id!==sessionEdit&&(s.started_on||null)===(sessionStart||null)&&s.finished_on===sessionFinish)){setMessage('This reading session already exists. Choose different dates or edit the existing session.');return}
  if(sessionStart&&sessionStart>sessionFinish){setMessage('Finish date cannot be before start date.');return}
  if(!journalDraft||journalDraft.status!=='finished'){setMessage('Only finished books can have completed reading sessions.');return}
  if(sessionFinish>todayLocal()){setMessage('A completed reading cannot have a future finish date.');return}
  setBusy(true)
  const payload={started_on:sessionStart||null,finished_on:sessionFinish}
  const request=sessionEdit?supabase.from('rc_reading_sessions').update(payload).eq('id',sessionEdit).eq('book_id',journalBook).eq('user_id',session.user.id):supabase.from('rc_reading_sessions').insert({...payload,book_id:journalBook,user_id:session.user.id})
  const {error}=await request
  if(error)setMessage(error.message)
  else{setSessionEdit(null);setSessionStart('');setSessionFinish('');await load()}
  setBusy(false)
 }
 async function deleteReadingSession(id){
  if(!window.confirm('Delete this reading session? The book will remain in your library.'))return
  setBusy(true)
  const {error}=await supabase.from('rc_reading_sessions').delete().eq('id',id).eq('book_id',journalBook).eq('user_id',session.user.id)
  if(error)setMessage(error.message)
  else{if(sessionEdit===id){setSessionEdit(null);setSessionStart('');setSessionFinish('')}await load()}
  setBusy(false)
 }
 async function saveJournal(e){
  e.preventDefault()
  if(journalDraft.started_on&&journalDraft.finished_on&&journalDraft.finished_on<journalDraft.started_on){setMessage('Finish date cannot be before start date.');return}
  if(journalDraft.rating!==null&&journalDraft.rating!==''&&journalDraft.status!=='finished'){setMessage('Ratings are for finished books only.');return}
  if(journalDraft.status==='finished'&&!journalDraft.finished_on){setMessage('Finished books need a finish date for yearly statistics and challenges.');return}
  if(journalDraft.finished_on&&journalDraft.finished_on>(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')})()){setMessage('Finish date cannot be in the future.');return}
  if(journalDraft.status==='to_read'&&(journalDraft.started_on||journalDraft.finished_on)){setMessage('To Read books cannot have reading dates. Change the status first, or clear the dates.');return}
  if(journalDraft.status==='finished'&&readingSessions.some(s=>s.book_id===journalDraft.id)&&journalDraft.finished_on!==readingSessions.filter(s=>s.book_id===journalDraft.id&&s.finished_on).map(s=>s.finished_on).sort().at(-1)){setMessage('The finish date must match the latest completed reading session. Edit the session dates below first.');return}
  if(journalDraft.status==='finished'&&readingSessions.some(s=>s.book_id===journalDraft.id)&&journalDraft.started_on&&readingSessions.some(s=>s.book_id===journalDraft.id&&s.started_on&&s.started_on<journalDraft.started_on)){setMessage('A recorded reading session begins before the book start date. Edit the journal start date or session dates.');return}
  const payload={started_on:journalDraft.started_on||null,finished_on:journalDraft.finished_on||null,rating:journalDraft.status==='finished'?(journalDraft.rating===''?null:journalDraft.rating):null,review:journalDraft.review||'',favorite:!!journalDraft.favorite}
  setBusy(true)
  const {data,error}=await supabase.from('rc_books').update(payload).eq('id',journalDraft.id).eq('updated_at',journalDraft.updated_at).select('id')
  setBusy(false)
  if(error)setMessage(error.message)
  else if(!data?.length)setMessage('This book was changed on another device. Sync and reopen your journal entry.')
  else{setJournalBook(null);setJournalDraft(null)}
  await load()
 }
 async function addQuote(e){
  e.preventDefault()
  if(!quoteText.trim())return
  setBusy(true)
  const {error}=await supabase.from('rc_quotes').insert({user_id:session.user.id,book_id:journalBook,quote:quoteText.trim()})
  setBusy(false)
  if(error)setMessage(error.message);else{setQuoteText('');await loadQuotes(journalBook)}
 }
 async function deleteQuote(id){if(!confirm('Delete this quote?'))return;const {error}=await supabase.from('rc_quotes').delete().eq('id',id);if(error)setMessage(error.message);else await loadQuotes(journalBook)}
 async function remove(book){
  if(!confirm('Delete this book?'))return
  const {data,error}=await supabase.from('rc_books').delete().eq('id',book.id).eq('updated_at',book.updated_at).select('id')
  if(error)setMessage(error.message);else if(!data?.length)setMessage('This book changed on another device. Sync before deleting.');await load()
 }
 return <div className={dark?'app dark':'app'} style={{'--accent':accent[tab]}}>
  <header><div><small>READING COMPANION</small><h1>{tab}</h1></div><button className="subtle" onClick={()=>setDark(!dark)} aria-label="Toggle dark mode">{dark?'☀':'☾'}</button></header>
  {!ready?<main>Loading…</main>:!session?<main className="auth"><h2>Your reading space</h2><p>Sign in to keep your books together on iPhone and Mac.</p><form onSubmit={e=>{e.preventDefault();auth('login')}}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy}>Sign in</button><button type="button" className="secondary" disabled={busy} onClick={()=>auth('signup')}>Create account</button></form></main>:
  <main>
   <div className="account"><span>{session.user.email}</span><div><button className="subtle" onClick={load}>↻ Sync</button><button className="subtle" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></div>
   {tab==='Home'?<><div className="hero"><small>YOUR READING SPACE</small><h2>Your next chapter starts here</h2><p>{books.filter(b=>b.status==='reading').length} currently reading · {books.length} books in your library</p></div><ReadingRewards books={books} sessions={readingSessions}/><ReleaseReminder books={books} userId={session.user.id} onSave={saveReleaseReminder}/><h2>Currently Reading</h2><div className="cards">{books.filter(b=>b.status==='reading').map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author}</p><p>{b.progress_mode==='page'&&b.page_count?`${b.current_page} / ${b.page_count} pages`:`${b.progress_percent}%`}</p><button className="subtle" onClick={()=>openEditor(b)}>Update progress</button></article>)}{!books.some(b=>b.status==='reading')&&<p>No books in progress yet.</p>}</div></>:
   tab==='Journal'?<><div className="hero"><h2>Your reading journal</h2><p>Reviews, reading dates, favorite books and quotes. DNF books are kept separate from completed reads.</p></div><div className="cards">{books.filter(b=>b.status==='finished'||b.status==='dnf'||b.status==='reading').map(b=><article key={b.id}><strong>{b.favorite?'♥ ':''}{b.title}</strong><p>{b.author||'Unknown author'} · {statuses.find(s=>s[0]===b.status)?.[1]}</p>{b.rating&&b.status==='finished'&&<p aria-label={`${b.rating} out of 5 stars`}>{'★'.repeat(b.rating)}{'☆'.repeat(5-b.rating)}</p>}{b.review&&<p>{b.review}</p>}<button className="subtle" onClick={()=>openJournal(b)}>Journal entry</button></article>)}{!books.some(b=>['finished','dnf','reading'].includes(b.status))&&<p>Start reading a book to create your first journal entry.</p>}</div></>:
   tab==='Statistics'?<StatisticsView books={books} sessions={readingSessions} onOpenJournal={openJournal}/>:
   tab==='Challenges'?<ChallengesView books={books} sessions={readingSessions} session={session}/>: 
   tab==='Series'?<SeriesShelf books={books} session={session} onEdit={openEditor} onStart={b=>change(b,'reading')} onViewLibrary={viewSeriesInLibrary}/>:
   tab==='Library'?<><div className="libraryToolbar"><label>Status <select value={libraryStatus} onChange={e=>setLibraryStatus(e.target.value)}><option value="all">All books</option>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Sort by <select value={librarySort} onChange={e=>setLibrarySort(e.target.value)}><option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option><option value="pages">Page count</option><option value="series">Series A–Z</option></select></label><span>{books.filter(b=>(libraryStatus==='all'||b.status===libraryStatus)&&(b.title+' '+b.author+' '+(b.series_name||'')).toLowerCase().includes(query.toLowerCase())).length} books</span></div><button type="button" className="secondary" onClick={()=>setShowLibraryTools(v=>!v)} aria-expanded={showLibraryTools}>{showLibraryTools?'Hide':'Show'} catalog search, import and add-book tools</button>{showLibraryTools&&<div className="libraryTools"><BookCatalogSearch books={books} onAdd={addCatalogBook} busy={busy}/><StoryGraphImport books={books} onImport={importStoryGraph} busy={busy}/><form className="add" onSubmit={add}><h2>Add a book</h2><input placeholder="Book title" aria-label="Book title" value={title} onChange={e=>setTitle(e.target.value)} required/><input placeholder="Author" aria-label="Author" value={author} onChange={e=>setAuthor(e.target.value)}/><button disabled={busy}>Add Book</button></form></div>}<section className="tbrPicker"><div><h3>Choose your next read</h3><p>Pick a random title from your To Read list, with optional filters.</p></div><div className="tbrOptions"><label>Book type<select value={tbrMode} onChange={e=>{setTbrMode(e.target.value);setNextPick(null)}}><option value="all">Any book</option><option value="standalone">No series assigned</option><option value="series">Series books</option></select></label><label>Author<input type="search" placeholder="Any author" value={tbrAuthor} onChange={e=>{setTbrAuthor(e.target.value);setNextPick(null)}}/></label><label>Format<select value={tbrFormat} onChange={e=>{setTbrFormat(e.target.value);setNextPick(null)}}><option value="all">Any format</option>{formats.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="tbrSafety"><input type="checkbox" checked={tbrSeriesSafe} onChange={e=>{setTbrSeriesSafe(e.target.checked);setNextPick(null)}}/>Only safe series order (numbered main volumes)</label><label>Minimum pages<input type="number" min="1" step="1" placeholder="Any length" value={tbrMinPages} onChange={e=>{setTbrMinPages(e.target.value);setNextPick(null)}}/></label><label>Maximum pages<input type="number" min="1" step="1" placeholder="Any length" value={tbrMaxPages} onChange={e=>{setTbrMaxPages(e.target.value);setNextPick(null)}}/></label></div><button type="button" className="subtle" onClick={()=>{setTbrMode('all');setTbrMinPages('');setTbrMaxPages('');setTbrAuthor('');setTbrFormat('all');setTbrSeriesSafe(false);setNextPick(null)}}>Reset filters</button><button type="button" disabled={!tbrEligible.length} onClick={()=>{const pick=tbrEligible[Math.floor(Math.random()*tbrEligible.length)];setNextPick(pick?.id||null)}}>Surprise me ({tbrEligible.length})</button>{nextPick&&books.some(b=>b.id===nextPick&&b.status==='to_read')&&<div className="tbrResult"><strong>{books.find(b=>b.id===nextPick)?.title}</strong>{books.find(b=>b.id===nextPick)?.series_name&&<small>{books.find(b=>b.id===nextPick)?.series_name}{books.find(b=>b.id===nextPick)?.series_number!=null?` #${books.find(b=>b.id===nextPick)?.series_number}`:""}</small>}<span>{books.find(b=>b.id===nextPick)?.author}</span><button className="subtle" onClick={()=>{const pick=books.find(b=>b.id===nextPick);if(pick)change(pick,'reading');setNextPick(null)}}>Start reading</button></div>}</section><input className="search" placeholder="Search your books…" aria-label="Search books" value={query} onChange={e=>setQuery(e.target.value)}/>{books.length===0&&<p>Your library is empty. Open the tools above to add your first book or import StoryGraph.</p>}{books.length>0&&!books.some(b=>(libraryStatus==='all'||b.status===libraryStatus)&&(b.title+' '+b.author+' '+(b.series_name||'')).toLowerCase().includes(query.toLowerCase()))&&<p>No books match these filters. Try another status or search.</p>}<div className="cards">{books.filter(b=>(libraryStatus==='all'||b.status===libraryStatus)&&(b.title+' '+b.author+' '+(b.series_name||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>librarySort==='title'?a.title.localeCompare(b.title):librarySort==='author'?(a.author||'').localeCompare(b.author||''):librarySort==='pages'?(a.page_count??Number.MAX_SAFE_INTEGER)-(b.page_count??Number.MAX_SAFE_INTEGER):librarySort==='series'?(a.series_name||'￿').localeCompare(b.series_name||'￿')||a.title.localeCompare(b.title):0).map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author||'Unknown author'}{b.series_name?' · '+b.series_name+(b.series_number!=null?' #'+b.series_number:''):''}</p><p>{b.progress_mode==='page'&&b.page_count?`${b.current_page} / ${b.page_count} pages`:`${b.progress_percent}%`}{b.book_format?` · ${formats.find(f=>f[0]===b.book_format)?.[1]}`:''}</p><div className="bookActions"><select aria-label={'Reading status for '+b.title} value={b.status} onChange={e=>change(b,e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="subtle" onClick={()=>openJournal(b)}>Journal</button><button className="subtle" onClick={()=>openEditor(b)}>Edit</button><button className="subtle" onClick={()=>remove(b)}>Delete</button></div></article>)}</div></>:
   <div className="hero"><h2>{tab} is coming soon</h2><p>The library comes first. This section will be added without unnecessary complexity.</p></div>}
   {journalBook&&journalDraft&&<div className="modalBackdrop" role="presentation"><section className="editor" role="dialog" aria-modal="true" aria-label="Reading journal entry"><h2>{journalDraft.title}</h2><form onSubmit={saveJournal}>
    <label>Started on<input type="date" value={journalDraft.started_on||''} onChange={e=>setJournalDraft({...journalDraft,started_on:e.target.value})}/></label>
    <label>Finished on<input type="date" value={journalDraft.finished_on||''} onChange={e=>setJournalDraft({...journalDraft,finished_on:e.target.value})}/></label>
    {journalDraft.status==='finished'&&<label>Rating (whole stars)<select value={journalDraft.rating??''} onChange={e=>setJournalDraft({...journalDraft,rating:e.target.value===''?null:Number(e.target.value)})}><option value="">Not rated</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>}
    <label>Review<textarea rows="4" value={journalDraft.review||''} onChange={e=>setJournalDraft({...journalDraft,review:e.target.value})}/></label>
    <label className="checkLabel"><input type="checkbox" checked={!!journalDraft.favorite} onChange={e=>setJournalDraft({...journalDraft,favorite:e.target.checked})}/> Favorite</label>
    <div className="editorActions"><button type="button" className="secondary" onClick={()=>{setJournalBook(null);setJournalDraft(null)}}>Close</button><button disabled={busy}>Save journal</button></div>
   </form><hr/><h3>Reading sessions</h3><p>Each completed reading is stored separately. Missing dates are not estimated. When sessions exist, the book finish date must match the most recent completed session.</p><ul>{readingSessions.filter(s=>s.book_id===journalBook).map(s=><li key={s.id}>{s.started_on||'Start unknown'} → {s.finished_on||'Finish unknown'} <button type="button" className="subtle" disabled={busy} onClick={()=>{setSessionEdit(s.id);setSessionStart(s.started_on||'');setSessionFinish(s.finished_on||'')}}>Edit session</button> <button type="button" className="subtle" disabled={busy} onClick={()=>deleteReadingSession(s.id)}>Delete session</button></li>)}</ul>{!readingSessions.some(s=>s.book_id===journalBook)&&<p>No separate reading sessions recorded yet.</p>}{journalDraft.status==='finished'&&<form onSubmit={saveReadingSession}><h4>{sessionEdit?'Edit reading session':'Add completed reading'}</h4><label>Started on (optional)<input type="date" value={sessionStart} onChange={e=>setSessionStart(e.target.value)}/></label><label>Finished on<input type="date" required value={sessionFinish} onChange={e=>setSessionFinish(e.target.value)}/></label><button disabled={busy}>{sessionEdit?'Save session':'Add session'}</button>{sessionEdit&&<button type="button" className="subtle" onClick={()=>{setSessionEdit(null);setSessionStart('');setSessionFinish('')}}>Cancel edit</button>}</form>}<hr/><h3>Quotes</h3><form onSubmit={addQuote}><textarea rows="3" placeholder="Save a favorite quote…" value={quoteText} onChange={e=>setQuoteText(e.target.value)}/><button disabled={busy||!quoteText.trim()}>Add quote</button></form><div className="quotes">{quotes.map(q=><blockquote key={q.id}>{q.quote}<button className="subtle" onClick={()=>deleteQuote(q.id)}>Delete</button></blockquote>)}</div></section></div>}
   {editing&&draft&&<div className="modalBackdrop" role="presentation"><section className="editor" role="dialog" aria-modal="true" aria-label="Edit book"><h2>Edit book</h2><form onSubmit={saveBook}>
     <label>Title<input value={draft.title} required onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <label>Author<input value={draft.author} onChange={e=>setDraft({...draft,author:e.target.value})}/></label>
     <label>Series (optional)<input value={draft.series_name||''} onChange={e=>setDraft({...draft,series_name:e.target.value})} placeholder="Series name"/></label>
     <fieldset className="editionMetadata"><legend>Edition details</legend><p>Catalog identifiers are shown for reference. Use the book search to add another edition.</p><div><strong>Source:</strong> {draft.catalog_source==='google_books'?'Google Books':'Manual entry'}</div>{draft.catalog_volume_id&&<div><strong>Catalog ID:</strong> {draft.catalog_volume_id}</div>}{draft.isbn_13&&<div><strong>ISBN-13:</strong> {draft.isbn_13}</div>}{draft.isbn_10&&<div><strong>ISBN-10:</strong> {draft.isbn_10}</div>}</fieldset>
     <label>Format<select value={draft.book_format||''} onChange={e=>setDraft({...draft,book_format:e.target.value})}>{formats.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label>Volume type<select value={draft.series_volume_kind||'main'} disabled={!draft.series_name?.trim()} onChange={e=>setDraft({...draft,series_volume_kind:e.target.value})}><option value="main">Main volume</option><option value="extra">Novella / extra</option><option value="omnibus">Omnibus / collected edition</option></select></label>
     <label>Series volume (optional)<input type="number" min="0.01" step="0.01" value={draft.series_number??''} disabled={!draft.series_name?.trim()} onChange={e=>setDraft({...draft,series_number:e.target.value})}/></label>
     <label>Tracking mode<select value={draft.progress_mode} onChange={e=>setDraft({...draft,progress_mode:e.target.value})}><option value="percent">Percent</option><option value="page">Pages</option></select></label>
     <label>Total pages (optional for percent)<input type="number" min="1" step="1" value={draft.page_count??''} onChange={e=>setDraft({...draft,page_count:e.target.value})}/></label>
     {draft.progress_mode==='page'?<label>Current page<input type="number" min="0" max={draft.page_count||undefined} value={draft.current_page} onChange={e=>setDraft({...draft,current_page:e.target.value})}/></label>:<label>Progress (%)<input type="number" min="0" max="100" value={draft.progress_percent} onChange={e=>setDraft({...draft,progress_percent:e.target.value})}/></label>}
     <div className="editorActions"><button type="button" className="secondary" onClick={()=>{setEditing(null);setDraft(null)}}>Cancel</button><button disabled={busy}>Save changes</button></div>
   </form></section></div>}
  </main>}
  {message&&<p role="status" className="message">{message}<button className="subtle" onClick={()=>setMessage('')}>×</button></p>}
  <nav aria-label="Main navigation">{tabs.map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''} style={{'--item':accent[t]}}>{t}</button>)}</nav>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>)
