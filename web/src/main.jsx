import React, {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import './style.css'

const tabs=['Home','Library','Series','Journal','Challenges','Statistics']
const accent={Home:'#8364AC',Library:'#695080',Series:'#6E739F',Journal:'#B76C9D',Challenges:'#417CA5',Statistics:'#315C87'}
const formats=[['','Not selected'],['paperback','Paperback'],['hardcover','Hardcover'],['ebook','E-book'],['audiobook','Audiobook']]
const statuses=[['to_read','To Read'],['reading','Currently Reading'],['finished','Finished'],['dnf','DNF']]
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function StatisticsView({books}){
 const [year,setYear]=useState(new Date().getFullYear())
 const finished=books.filter(b=>b.status==='finished')
 const dated=finished.filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.finished_on||''))
 const yearly=dated.filter(b=>Number(b.finished_on.slice(0,4))===year)
 const monthly=monthNames.map((name,i)=>({name,items:yearly.filter(b=>Number(b.finished_on.slice(5,7))===i+1)}))
 const pages=items=>items.reduce((n,b)=>n+(b.page_count||0),0)
 const rated=items=>items.filter(b=>Number.isInteger(b.rating)&&b.rating>=1&&b.rating<=5)
 const average=items=>{const r=rated(items);return r.length?(r.reduce((s,b)=>s+b.rating,0)/r.length).toFixed(1):'—'}
 const current=new Date().getFullYear()
 const years=[...new Set([current,...dated.map(b=>Number(b.finished_on.slice(0,4)))])].sort((a,b)=>b-a)
 return <section className="stats">
  <div className="hero"><h2>Your reading statistics</h2><p>Only finished books count. Add a finish date to include a book in monthly and yearly totals.</p></div>
  <h2>Lifetime</h2><div className="statGrid">
   <article><strong>{finished.length}</strong><span>Finished books</span></article>
   <article><strong>{pages(finished).toLocaleString('en-US')}</strong><span>Known pages</span></article>
   <article><strong>{average(finished)}</strong><span>Average rating</span></article>
   <article><strong>{finished.filter(b=>b.favorite).length}</strong><span>Favorites</span></article>
  </div>
  <p className="statsNote">{finished.length-dated.length} finished {finished.length-dated.length===1?'book has':'books have'} no finish date and {finished.filter(b=>!b.page_count).length} {finished.filter(b=>!b.page_count).length===1?'book has':'books have'} no page count. Missing values are never estimated.</p>
  <div className="statsHeading"><h2>Yearly</h2><label>Year <select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
  <div className="statGrid">
   <article><strong>{yearly.length}</strong><span>Finished books</span></article>
   <article><strong>{pages(yearly).toLocaleString('en-US')}</strong><span>Known pages</span></article>
   <article><strong>{average(yearly)}</strong><span>Average rating</span></article>
  </div>
  <h2>Monthly · {year}</h2>
  <div className="monthGrid">{monthly.map(m=><article key={m.name}><strong>{m.name}</strong><span>{m.items.length} {m.items.length===1?'book':'books'}</span><small>{pages(m.items).toLocaleString('en-US')} known pages</small></article>)}</div>
  <h2>Books finished in {year}</h2>
  <div className="cards">{yearly.slice().sort((a,b)=>b.finished_on.localeCompare(a.finished_on)).map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.finished_on} · {b.author||'Unknown author'}</p></article>)}{!yearly.length&&<p>No dated finished books for this year.</p>}</div>
 </section>
}
const worldCities={
 A:{easy:['New York City','London','Boston','Chicago','Los Angeles','Paris','Seattle','San Francisco','Toronto','Washington, D.C.'],challenge:['Rome','Dublin','Barcelona','Sydney','Tokyo','Amsterdam','Florence','Lisbon','Vancouver','Edinburgh']},
 B:{easy:['New York City','London','Philadelphia','Miami','Nashville','New Orleans','Montreal','Oxford','Milan','Madrid'],challenge:['Prague','Vienna','Copenhagen','Athens','Seoul','Singapore','Istanbul','Melbourne','Berlin','Porto']}
}
function AroundWorldView({books,session,year,variant}){
 const [entries,setEntries]=useState([])
 const [error,setError]=useState('')
 const [pending,setPending]=useState(null)
 const [verified,setVerified]=useState(false)
 const [busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;setEntries([]);setPending(null);setVerified(false);supabase.from('rc_world_entries').select('id,city,book_id').eq('challenge_year',year).then(({data,error})=>{if(active){if(error)setError(error.message);else{setEntries(data||[]);setError('')}}});return()=>{active=false}},[year,session.user.id])
 const eligible=books.filter(b=>b.status==='finished'&&b.finished_on?.startsWith(String(year))&&!entries.some(e=>e.book_id===b.id))
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
function PromptChallengeView({books,session,year,variant,challenge}){
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
 const eligible=books.filter(b=>b.status==='finished'&&b.finished_on?.startsWith(String(year))&&!assignments.some(a=>a.book_id===b.id)&&!(challenge==='tropes'&&b.series_name?.trim()&&assignments.filter(a=>{const other=books.find(x=>x.id===a.book_id);return other?.series_name?.trim().toLowerCase()===b.series_name.trim().toLowerCase()}).length>=2))
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
function CalendarChallengeView({books,session,year,variant,challenge}){
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
 const eligible=books.filter(b=>{if(b.status!=='finished'||!b.finished_on?.startsWith(String(year))||entries.some(e=>e.book_id===b.id))return false
  const m=Number(b.finished_on.slice(5,7))
  return challenge==='monthly'?m===monthNumber:seasonMonths[selected].includes(m)
 })
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
function RouletteView({books,session,year,variant}){
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
  const unread=group.filter(b=>b.status==='to_read'&&b.series_number!=null).sort((a,b)=>Number(a.series_number)-Number(b.series_number))
  if(!unread.length)return []
  const next=unread[0]
  const previous=group.filter(b=>['finished','reading'].includes(b.status)&&b.series_number!=null)
  if(!previous.length||!previous.some(b=>Number(b.series_number)<Number(next.series_number)))return []
  const priorUnread=group.some(b=>b.status==='to_read'&&b.series_number!=null&&Number(b.series_number)<Number(next.series_number))
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
 const eligible=books.filter(b=>b.status==='finished'&&b.finished_on?.startsWith(String(year))&&!entries.some(e=>e.book_id===b.id))
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
function ChallengesView({books,session}){
 const [year,setYear]=useState(new Date().getFullYear())
 const [challengeTab,setChallengeTab]=useState('alphabet')
 const [entries,setEntries]=useState([])
 const [error,setError]=useState('')
 const [working,setWorking]=useState(false)
 const variant=year%2===0?'A':'B'
 useEffect(()=>{let active=true;supabase.from('rc_challenge_entries').select('id,prompt,book_id').eq('challenge','alphabet').eq('challenge_year',year).then(({data,error})=>{if(active){if(error)setError(error.message);else{setEntries(data||[]);setError('')}}});return()=>{active=false}},[year,session.user.id])
 const available=books.filter(b=>b.status==='finished'&&b.finished_on?.startsWith(String(year)))
 async function assign(letter,bookId){
  setWorking(true);setError('')
  const existing=entries.find(e=>e.prompt===letter)
  const {error}=bookId?await supabase.from('rc_challenge_entries').insert({user_id:session.user.id,challenge:'alphabet',challenge_year:year,prompt:letter,book_id:bookId}):existing?await supabase.from('rc_challenge_entries').delete().eq('id',existing.id):{error:null}
  if(error)setError(error.message)
  const result=await supabase.from('rc_challenge_entries').select('id,prompt,book_id').eq('challenge','alphabet').eq('challenge_year',year)
  if(result.error)setError(result.error.message);else setEntries(result.data||[])
  setWorking(false)
 }
 const years=[...new Set([new Date().getFullYear(),...books.map(b=>Number(b.finished_on?.slice(0,4))).filter(y=>y>=2020&&y<=2100)])].sort((a,b)=>b-a)
 return <section className="challenges">
  <div className="hero"><h2>Reading challenges</h2><p>Seven challenges, one reading year. Choose a challenge to view its prompts and record your books.</p></div>
  <div className="challengeSwitch"><button className={challengeTab==='alphabet'?'active':''} onClick={()=>setChallengeTab('alphabet')}>Alphabet</button><button className={challengeTab==='world'?'active':''} onClick={()=>setChallengeTab('world')}>Around the World</button><button className={challengeTab==='tropes'?'active':''} onClick={()=>setChallengeTab('tropes')}>Tropes</button><button className={challengeTab==='archetypes'?'active':''} onClick={()=>setChallengeTab('archetypes')}>Archetypes</button><button className={challengeTab==='monthly'?'active':''} onClick={()=>setChallengeTab('monthly')}>Monthly</button><button className={challengeTab==='seasonal'?'active':''} onClick={()=>setChallengeTab('seasonal')}>Seasonal</button><button className={challengeTab==='roulette'?'active':''} onClick={()=>setChallengeTab('roulette')}>Reading Roulette</button></div>
  <div className="statsHeading"><h2>{({alphabet:'Alphabet Challenge',world:'Around the World',tropes:'Tropes Challenge',archetypes:'Archetypes Challenge',monthly:'Monthly Challenge',seasonal:'Seasonal Challenge',roulette:'Reading Roulette'})[challengeTab]} · Version {variant}</h2><label>Year <select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
  {challengeTab==='roulette'?<RouletteView key={year} books={books} session={session} year={year} variant={variant}/>:challengeTab==='monthly'||challengeTab==='seasonal'?<CalendarChallengeView key={challengeTab+year} books={books} session={session} year={year} variant={variant} challenge={challengeTab}/>:challengeTab==='world'?<AroundWorldView books={books} session={session} year={year} variant={variant}/>:challengeTab==='tropes'||challengeTab==='archetypes'?<PromptChallengeView key={challengeTab+year} books={books} session={session} year={year} variant={variant} challenge={challengeTab}/>:<>
  <p>{entries.length} / 26 letters filled · {26-entries.length} available</p>
  {error&&<p role="alert" className="message">{error}</p>}
  <div className="alphabetGrid">{alphabet.map(letter=>{
   const assigned=entries.find(e=>e.prompt===letter)
   const match=assigned&&books.find(b=>b.id===assigned.book_id)
   const choices=available.filter(b=>b.title.trim().charAt(0).toUpperCase()===letter&&!entries.some(e=>e.book_id===b.id))
   return <article key={letter} className={assigned?'filled':''}><strong>{letter}</strong><span>{match?match.title:'Available'}</span>
    {assigned?<button className="subtle" disabled={working} onClick={()=>assign(letter,null)}>Remove</button>:<select aria-label={'Assign a book to letter '+letter} disabled={working||!choices.length} value="" onChange={e=>assign(letter,e.target.value)}><option value="">{choices.length?'Choose book…':'No eligible books'}</option>{choices.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>}
   </article>
  })}</div>
  <p className="statsNote">Eligible books must be marked Finished, have a finish date in the selected year, and begin with the selected letter. Other challenges will be added using your exact prompt lists.</p></>}
 </section>
}
function SeriesShelf({books,onEdit,onStart,onViewLibrary,session}){
 const [metadata,setMetadata]=useState([])
 const [saving,setSaving]=useState('')
 const [error,setError]=useState('')
 const [seriesQuery,setSeriesQuery]=useState('')
 const [seriesFilter,setSeriesFilter]=useState('all')
 const [seriesSort,setSeriesSort]=useState('name')
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
 const visibleGroups=groups.filter(g=>g.name.toLocaleLowerCase().includes(seriesQuery.trim().toLocaleLowerCase())&&(seriesFilter==='all'||(metadata.find(m=>m.name.toLocaleLowerCase()===g.name.toLocaleLowerCase())?.status||'ongoing')===seriesFilter)).sort((a,b)=>seriesSort==='unread'?b.items.filter(x=>x.status==='to_read').length-a.items.filter(x=>x.status==='to_read').length||a.name.localeCompare(b.name):seriesSort==='finished'?b.items.filter(x=>x.status==='finished').length-a.items.filter(x=>x.status==='finished').length||a.name.localeCompare(b.name):a.name.localeCompare(b.name))
 if(!groups.length)return <section className="hero"><h2>Your series</h2><p>Add a series name and optional volume number to a book to start tracking your series.</p></section>
 return <section className="seriesShelf"><div className="hero"><h2>Your series</h2><p>{groups.length} series in your library. Volumes are ordered by number when known; missing volumes are not invented.</p></div>
 <div className="seriesToolbar"><label>Find a series<input value={seriesQuery} onChange={e=>setSeriesQuery(e.target.value)} placeholder="Search series…" /></label><label>Publication status<select value={seriesFilter} onChange={e=>setSeriesFilter(e.target.value)}><option value="all">All series</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="abandoned">Abandoned</option></select></label><label>Sort by<select value={seriesSort} onChange={e=>setSeriesSort(e.target.value)}><option value="name">Name A–Z</option><option value="unread">Most unread</option><option value="finished">Most finished</option></select></label><span>{visibleGroups.length} / {groups.length} series</span></div>{!visibleGroups.length&&<p>No series match your filters.</p>}<div className="seriesGrid">{visibleGroups.map(group=>{
  const ordered=[...group.items].sort((a,b)=>(a.series_number??Number.POSITIVE_INFINITY)-(b.series_number??Number.POSITIVE_INFINITY)||a.title.localeCompare(b.title))
  const unread=ordered.filter(b=>b.status==='to_read')
  const next=unread[0]
  const meta=metadata.find(m=>m.name.toLocaleLowerCase()===group.name.toLocaleLowerCase())
  const numbered=ordered.filter(b=>b.series_number!=null)
  const duplicates=[...new Set(numbered.filter((b,i)=>numbered.some((other,j)=>j!==i&&Number(other.series_number)===Number(b.series_number))).map(b=>Number(b.series_number)))]
  const mainVolumes=new Set(numbered.filter(b=>Number.isInteger(Number(b.series_number))).map(b=>Number(b.series_number)))
  const missing=meta?.total_volumes!=null&&meta.total_volumes<=500?Array.from({length:meta.total_volumes},(_,i)=>i+1).filter(n=>!mainVolumes.has(n)):[]
  const mainBooks=numbered.filter(b=>Number.isInteger(Number(b.series_number))&&Number(b.series_number)>=1&&Number(b.series_number)<=(meta?.total_volumes??0))
  const recordedComplete=meta?.total_volumes!=null&&meta.total_volumes<=500&&missing.length===0&&duplicates.length===0&&mainBooks.length===meta.total_volumes&&mainBooks.every(b=>b.status==='finished')
  return <article key={group.name} className="seriesCard"><h3>{group.name}</h3><form className="seriesSettings" onSubmit={e=>{e.preventDefault();saveSeries(group,e.currentTarget.elements.seriesStatus.value,e.currentTarget.elements.totalVolumes.value)}}><label>Series status<select name="seriesStatus" key={meta?.status||'ongoing'} defaultValue={meta?.status||'ongoing'}><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="abandoned">Abandoned</option></select></label><label>Total volumes (optional)<input name="totalVolumes" key={String(meta?.total_volumes??'')} type="number" min="1" step="1" defaultValue={meta?.total_volumes??''}/></label><button disabled={saving===group.name}>Save series</button></form><p>{ordered.filter(b=>b.status==='finished').length} finished · {ordered.length} recorded{meta?.total_volumes!=null?' · '+meta.total_volumes+' total volumes':''}</p>
   {meta?.total_volumes!=null&&<div className="seriesProgress"><div className="seriesProgressTrack" role="progressbar" aria-label={'Recorded finished books in '+group.name} aria-valuemin="0" aria-valuemax={meta.total_volumes} aria-valuenow={Math.min(ordered.filter(b=>b.status==='finished').length,meta.total_volumes)}><span style={{width:Math.min(100,100*ordered.filter(b=>b.status==='finished').length/meta.total_volumes)+'%'}}/></div><small>{ordered.filter(b=>b.status==='finished').length} recorded books finished / {meta.total_volumes} stated volumes</small></div>}
   {meta?.total_volumes!=null&&mainVolumes.size<meta.total_volumes&&<p className="seriesCaution">The numbered main-volume collection may be incomplete. Extras and unnumbered books do not fill missing main-volume slots.</p>}
   {meta?.total_volumes!=null&&ordered.length>meta.total_volumes&&<p className="seriesCaution">Additional entries may be novellas, extras, omnibus editions or duplicates; check their numbering.</p>}
   {ordered.some(b=>b.series_number==null)&&<p className="seriesCaution">Some volumes have no number; reading order may be incomplete.</p>}
   {duplicates.length>0&&<p className="seriesCaution">Repeated volume numbers: {duplicates.sort((a,b)=>a-b).join(', ')}. Check for duplicate entries or editions.</p>}
   {missing.length>0&&<p className="seriesCaution">Missing numbered volumes in your library: {missing.slice(0,18).join(', ')}{missing.length>18?' … ('+missing.length+' total)':''}. This assumes main volumes are numbered 1 through {meta.total_volumes}; special editions may differ.</p>}
   {meta?.total_volumes!=null&&meta.total_volumes>500&&<p className="seriesCaution">Volume gap detection is limited to series of 500 volumes or fewer.</p>}
   {meta?.status==='completed'&&<p className="seriesCaution">Publication complete (manually set) · {recordedComplete?'all numbered main volumes are recorded and marked finished':'your recorded reading may still be incomplete'}.</p>}
   {recordedComplete&&<p className="seriesCompletion">All stated numbered main volumes are recorded and marked finished. Extras are tracked separately.</p>}
   <button className="subtle" onClick={()=>onViewLibrary(group.name)}>Browse these books in Library</button><ol>{ordered.map(b=><li key={b.id}><span>{b.series_number!=null?'#'+b.series_number+' · ':''}{b.title}</span><small>{b.status==='finished'?'Finished':b.status==='reading'?'Reading':b.status==='dnf'?'DNF':'To Read'}</small><button className="subtle" onClick={()=>onEdit(b)}>Edit</button></li>)}</ol>
   {next&&<div className="seriesNext"><span>Next recorded unread volume: <strong>{next.title}</strong></span><button onClick={()=>onStart(next)}>Start reading</button></div>}
  </article>
 })}</div></section>
}
function App(){
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('')
 const [editing,setEditing]=useState(null),[draft,setDraft]=useState(null)
 const [journalBook,setJournalBook]=useState(null),[journalDraft,setJournalDraft]=useState(null),[quotes,setQuotes]=useState([]),[quoteText,setQuoteText]=useState('')
 const [tbrMode,setTbrMode]=useState('all'),[tbrMaxPages,setTbrMaxPages]=useState(''),[tbrMinPages,setTbrMinPages]=useState(''),[tab,setTab]=useState('Home'),[books,setBooks]=useState([]),[title,setTitle]=useState(''),[author,setAuthor]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[dark,setDark]=useState(false),[libraryStatus,setLibraryStatus]=useState('all'),[librarySort,setLibrarySort]=useState('recent'),[nextPick,setNextPick]=useState(null)
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return ()=>subscription.unsubscribe()},[])
 async function load(){if(!session)return;const {data,error}=await supabase.from('rc_books').select('id,title,author,status,updated_at,page_count,current_page,progress_percent,progress_mode,book_format,started_on,finished_on,rating,review,favorite,series_name,series_number').order('created_at',{ascending:false});if(error)setMessage(error.message);else setBooks(data)}
 useEffect(()=>{if(session)load();else setBooks([])},[session?.user?.id])
 useEffect(()=>{const onFocus=()=>{if(session)load()};const onVisible=()=>{if(document.visibilityState==='visible'&&session)load()};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[session])
 async function auth(mode){setBusy(true);setMessage('');const {error}=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});setBusy(false);setMessage(error?error.message:mode==='signup'?'Account created. Check your email if confirmation is required.':'')}
 async function add(e){e.preventDefault();if(!title.trim())return;setBusy(true);const {error}=await supabase.from('rc_books').insert({title:title.trim(),author:author.trim(),user_id:session.user.id});setBusy(false);if(error)setMessage(error.message);else{setTitle('');setAuthor('');await load()}}
 async function change(book,status){
  const {data,error}=await supabase.from('rc_books').update({status}).eq('id',book.id).eq('updated_at',book.updated_at).select('id')
  if(error)setMessage(error.message);else if(!data?.length)setMessage('This book changed on another device. Sync and try again.');await load()
 }
 function openEditor(book){setEditing(book.id);setDraft({...book})}
 function viewSeriesInLibrary(name){setTab('Library');setLibraryStatus('all');setQuery(name)}
 const tbrEligible=books.filter(b=>b.status==='to_read'&&(tbrMode!=='standalone'||!b.series_name?.trim())&&(tbrMode!=='series'||b.series_name?.trim())&&(tbrMaxPages===''||(b.page_count!=null&&Number(b.page_count)<=Number(tbrMaxPages)))&&(tbrMinPages===''||(b.page_count!=null&&Number(b.page_count)>=Number(tbrMinPages))))
 async function saveBook(e){
  e.preventDefault()
  if(!draft?.title?.trim())return
  const pageCount=draft.page_count===''||draft.page_count==null?null:Number(draft.page_count)
  const page=Number(draft.current_page)||0
  const percent=Number(draft.progress_percent)||0
  if(pageCount!==null&&(!Number.isInteger(pageCount)||pageCount<1)){setMessage('Page count must be a positive whole number.');return}
  if(draft.progress_mode==='page'&&pageCount===null){setMessage('Enter a page count to track pages, or select percent.');return}
  if(page<0||(pageCount!==null&&page>pageCount)||percent<0||percent>100){setMessage('Check your progress values.');return}
  if(draft.series_name?.trim()&&draft.series_number!==''&&draft.series_number!=null&&(!Number.isFinite(Number(draft.series_number))||Number(draft.series_number)<=0)){setMessage('Series volume must be a positive number.');return}
  setBusy(true)
  const payload={title:draft.title.trim(),author:draft.author.trim(),series_name:draft.series_name?.trim()||null,series_number:draft.series_name?.trim()&&draft.series_number!==''&&draft.series_number!=null?Number(draft.series_number):null,book_format:draft.book_format||null,page_count:pageCount,current_page:page,progress_percent:percent,progress_mode:draft.progress_mode}
  const {data,error}=await supabase.from('rc_books').update(payload).eq('id',draft.id).eq('updated_at',draft.updated_at).select('id')
  setBusy(false)
  if(error)setMessage(error.message)
  else if(!data?.length)setMessage('This book was changed on another device. Your changes were not saved. Sync and reopen it.')
  else{setEditing(null);setDraft(null)}
  await load()
 }
 function openJournal(book){setJournalBook(book.id);setJournalDraft({...book});setQuoteText('');loadQuotes(book.id)}
 async function loadQuotes(bookId){const {data,error}=await supabase.from('rc_quotes').select('id,quote,created_at').eq('book_id',bookId).order('created_at',{ascending:false});if(error)setMessage(error.message);else setQuotes(data)}
 async function saveJournal(e){
  e.preventDefault()
  if(journalDraft.started_on&&journalDraft.finished_on&&journalDraft.finished_on<journalDraft.started_on){setMessage('Finish date cannot be before start date.');return}
  if(journalDraft.rating!==null&&journalDraft.rating!==''&&journalDraft.status!=='finished'){setMessage('Ratings are for finished books only.');return}
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
   {tab==='Home'?<><div className="hero"><small>YOUR READING SPACE</small><h2>Your next chapter starts here</h2><p>{books.filter(b=>b.status==='reading').length} currently reading · {books.length} books in your library</p></div><h2>Currently Reading</h2><div className="cards">{books.filter(b=>b.status==='reading').map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author}</p><p>{b.progress_mode==='page'&&b.page_count?`${b.current_page} / ${b.page_count} pages`:`${b.progress_percent}%`}</p><button className="subtle" onClick={()=>openEditor(b)}>Update progress</button></article>)}{!books.some(b=>b.status==='reading')&&<p>No books in progress yet.</p>}</div></>:
   tab==='Journal'?<><div className="hero"><h2>Your reading journal</h2><p>Reviews, reading dates, favorite books and quotes. DNF books are kept separate from completed reads.</p></div><div className="cards">{books.filter(b=>b.status==='finished'||b.status==='dnf'||b.status==='reading').map(b=><article key={b.id}><strong>{b.favorite?'♥ ':''}{b.title}</strong><p>{b.author||'Unknown author'} · {statuses.find(s=>s[0]===b.status)?.[1]}</p>{b.rating&&b.status==='finished'&&<p aria-label={`${b.rating} out of 5 stars`}>{'★'.repeat(b.rating)}{'☆'.repeat(5-b.rating)}</p>}{b.review&&<p>{b.review}</p>}<button className="subtle" onClick={()=>openJournal(b)}>Journal entry</button></article>)}{!books.some(b=>['finished','dnf','reading'].includes(b.status))&&<p>Start reading a book to create your first journal entry.</p>}</div></>:
   tab==='Statistics'?<StatisticsView books={books}/>:
   tab==='Challenges'?<ChallengesView books={books} session={session}/>: 
   tab==='Series'?<SeriesShelf books={books} session={session} onEdit={openEditor} onStart={b=>change(b,'reading')} onViewLibrary={viewSeriesInLibrary}/>:
   tab==='Library'?<><div className="libraryToolbar"><label>Status <select value={libraryStatus} onChange={e=>setLibraryStatus(e.target.value)}><option value="all">All books</option>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Sort by <select value={librarySort} onChange={e=>setLibrarySort(e.target.value)}><option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option><option value="pages">Page count</option><option value="series">Series A–Z</option></select></label><span>{books.filter(b=>(libraryStatus==='all'||b.status===libraryStatus)&&(b.title+' '+b.author+' '+(b.series_name||'')).toLowerCase().includes(query.toLowerCase())).length} books</span></div><form className="add" onSubmit={add}><h2>Add a book</h2><input placeholder="Book title" aria-label="Book title" value={title} onChange={e=>setTitle(e.target.value)} required/><input placeholder="Author" aria-label="Author" value={author} onChange={e=>setAuthor(e.target.value)}/><button disabled={busy}>Add Book</button></form><section className="tbrPicker"><div><h3>Choose your next read</h3><p>Pick a random title from your To Read list, with optional filters.</p></div><div className="tbrOptions"><label>Book type<select value={tbrMode} onChange={e=>{setTbrMode(e.target.value);setNextPick(null)}}><option value="all">Any book</option><option value="standalone">No series assigned</option><option value="series">Series books</option></select></label><label>Minimum pages<input type="number" min="1" step="1" placeholder="Any length" value={tbrMinPages} onChange={e=>{setTbrMinPages(e.target.value);setNextPick(null)}}/></label><label>Maximum pages<input type="number" min="1" step="1" placeholder="Any length" value={tbrMaxPages} onChange={e=>{setTbrMaxPages(e.target.value);setNextPick(null)}}/></label></div><button type="button" disabled={!tbrEligible.length} onClick={()=>{const pick=tbrEligible[Math.floor(Math.random()*tbrEligible.length)];setNextPick(pick?.id||null)}}>Surprise me ({tbrEligible.length})</button>{nextPick&&books.some(b=>b.id===nextPick&&b.status==='to_read')&&<div className="tbrResult"><strong>{books.find(b=>b.id===nextPick)?.title}</strong>{books.find(b=>b.id===nextPick)?.series_name&&<small>{books.find(b=>b.id===nextPick)?.series_name}{books.find(b=>b.id===nextPick)?.series_number!=null?` #${books.find(b=>b.id===nextPick)?.series_number}`:""}</small>}<span>{books.find(b=>b.id===nextPick)?.author}</span><button className="subtle" onClick={()=>{const pick=books.find(b=>b.id===nextPick);if(pick)change(pick,'reading');setNextPick(null)}}>Start reading</button></div>}</section><input className="search" placeholder="Search your books…" aria-label="Search books" value={query} onChange={e=>setQuery(e.target.value)}/><div className="cards">{books.filter(b=>(libraryStatus==='all'||b.status===libraryStatus)&&(b.title+' '+b.author+' '+(b.series_name||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>librarySort==='title'?a.title.localeCompare(b.title):librarySort==='author'?(a.author||'').localeCompare(b.author||''):librarySort==='pages'?(a.page_count??Number.MAX_SAFE_INTEGER)-(b.page_count??Number.MAX_SAFE_INTEGER):librarySort==='series'?(a.series_name||'￿').localeCompare(b.series_name||'￿')||a.title.localeCompare(b.title):0).map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author||'Unknown author'}{b.series_name?' · '+b.series_name+(b.series_number!=null?' #'+b.series_number:''):''}</p><p>{b.progress_mode==='page'&&b.page_count?`${b.current_page} / ${b.page_count} pages`:`${b.progress_percent}%`}{b.book_format?` · ${formats.find(f=>f[0]===b.book_format)?.[1]}`:''}</p><div className="bookActions"><select aria-label={'Reading status for '+b.title} value={b.status} onChange={e=>change(b,e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="subtle" onClick={()=>openEditor(b)}>Edit</button><button className="subtle" onClick={()=>remove(b)}>Delete</button></div></article>)}</div></>:
   <div className="hero"><h2>{tab} is coming soon</h2><p>The library comes first. This section will be added without unnecessary complexity.</p></div>}
   {journalBook&&journalDraft&&<div className="modalBackdrop" role="presentation"><section className="editor" role="dialog" aria-modal="true" aria-label="Reading journal entry"><h2>{journalDraft.title}</h2><form onSubmit={saveJournal}>
    <label>Started on<input type="date" value={journalDraft.started_on||''} onChange={e=>setJournalDraft({...journalDraft,started_on:e.target.value})}/></label>
    <label>Finished on<input type="date" value={journalDraft.finished_on||''} onChange={e=>setJournalDraft({...journalDraft,finished_on:e.target.value})}/></label>
    {journalDraft.status==='finished'&&<label>Rating (whole stars)<select value={journalDraft.rating??''} onChange={e=>setJournalDraft({...journalDraft,rating:e.target.value===''?null:Number(e.target.value)})}><option value="">Not rated</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>}
    <label>Review<textarea rows="4" value={journalDraft.review||''} onChange={e=>setJournalDraft({...journalDraft,review:e.target.value})}/></label>
    <label className="checkLabel"><input type="checkbox" checked={!!journalDraft.favorite} onChange={e=>setJournalDraft({...journalDraft,favorite:e.target.checked})}/> Favorite</label>
    <div className="editorActions"><button type="button" className="secondary" onClick={()=>{setJournalBook(null);setJournalDraft(null)}}>Close</button><button disabled={busy}>Save journal</button></div>
   </form><hr/><h3>Quotes</h3><form onSubmit={addQuote}><textarea rows="3" placeholder="Save a favorite quote…" value={quoteText} onChange={e=>setQuoteText(e.target.value)}/><button disabled={busy||!quoteText.trim()}>Add quote</button></form><div className="quotes">{quotes.map(q=><blockquote key={q.id}>{q.quote}<button className="subtle" onClick={()=>deleteQuote(q.id)}>Delete</button></blockquote>)}</div></section></div>}
   {editing&&draft&&<div className="modalBackdrop" role="presentation"><section className="editor" role="dialog" aria-modal="true" aria-label="Edit book"><h2>Edit book</h2><form onSubmit={saveBook}>
     <label>Title<input value={draft.title} required onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <label>Author<input value={draft.author} onChange={e=>setDraft({...draft,author:e.target.value})}/></label>
     <label>Series (optional)<input value={draft.series_name||''} onChange={e=>setDraft({...draft,series_name:e.target.value})} placeholder="Series name"/></label>
     <label>Format<select value={draft.book_format||''} onChange={e=>setDraft({...draft,book_format:e.target.value})}>{formats.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
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
