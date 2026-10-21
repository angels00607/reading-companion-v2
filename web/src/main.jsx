import React, {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import './style.css'

const tabs=['Home','Library','Journal','Challenges','Statistics']
const accent={Home:'#8364AC',Library:'#695080',Journal:'#B76C9D',Challenges:'#417CA5',Statistics:'#315C87'}
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
  <div className="hero"><h2>Reading challenges</h2><p>Track your prompts with verified books. Each book can fill only one Alphabet prompt per year.</p></div>
  <div className="challengeSwitch"><button className={challengeTab==='alphabet'?'active':''} onClick={()=>setChallengeTab('alphabet')}>Alphabet</button><button className={challengeTab==='world'?'active':''} onClick={()=>setChallengeTab('world')}>Around the World</button></div>
  <div className="statsHeading"><h2>{challengeTab==='alphabet'?'Alphabet Challenge':'Around the World'} · Version {variant}</h2><label>Year <select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
  {challengeTab==='world'?<AroundWorldView books={books} session={session} year={year} variant={variant}/>:<>
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
function App(){
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('')
 const [editing,setEditing]=useState(null),[draft,setDraft]=useState(null)
 const [journalBook,setJournalBook]=useState(null),[journalDraft,setJournalDraft]=useState(null),[quotes,setQuotes]=useState([]),[quoteText,setQuoteText]=useState('')
 const [tab,setTab]=useState('Home'),[books,setBooks]=useState([]),[title,setTitle]=useState(''),[author,setAuthor]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[dark,setDark]=useState(false)
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return ()=>subscription.unsubscribe()},[])
 async function load(){if(!session)return;const {data,error}=await supabase.from('rc_books').select('id,title,author,status,updated_at,page_count,current_page,progress_percent,progress_mode,book_format,started_on,finished_on,rating,review,favorite').order('created_at',{ascending:false});if(error)setMessage(error.message);else setBooks(data)}
 useEffect(()=>{if(session)load();else setBooks([])},[session?.user?.id])
 useEffect(()=>{const onFocus=()=>{if(session)load()};const onVisible=()=>{if(document.visibilityState==='visible'&&session)load()};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[session])
 async function auth(mode){setBusy(true);setMessage('');const {error}=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});setBusy(false);setMessage(error?error.message:mode==='signup'?'Account created. Check your email if confirmation is required.':'')}
 async function add(e){e.preventDefault();if(!title.trim())return;setBusy(true);const {error}=await supabase.from('rc_books').insert({title:title.trim(),author:author.trim(),user_id:session.user.id});setBusy(false);if(error)setMessage(error.message);else{setTitle('');setAuthor('');await load()}}
 async function change(book,status){
  const {data,error}=await supabase.from('rc_books').update({status}).eq('id',book.id).eq('updated_at',book.updated_at).select('id')
  if(error)setMessage(error.message);else if(!data?.length)setMessage('This book changed on another device. Sync and try again.');await load()
 }
 function openEditor(book){setEditing(book.id);setDraft({...book})}
 async function saveBook(e){
  e.preventDefault()
  if(!draft?.title?.trim())return
  const pageCount=draft.page_count===''||draft.page_count==null?null:Number(draft.page_count)
  const page=Number(draft.current_page)||0
  const percent=Number(draft.progress_percent)||0
  if(pageCount!==null&&(!Number.isInteger(pageCount)||pageCount<1)){setMessage('Page count must be a positive whole number.');return}
  if(draft.progress_mode==='page'&&pageCount===null){setMessage('Enter a page count to track pages, or select percent.');return}
  if(page<0||(pageCount!==null&&page>pageCount)||percent<0||percent>100){setMessage('Check your progress values.');return}
  setBusy(true)
  const payload={title:draft.title.trim(),author:draft.author.trim(),book_format:draft.book_format||null,page_count:pageCount,current_page:page,progress_percent:percent,progress_mode:draft.progress_mode}
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
   tab==='Library'?<><form className="add" onSubmit={add}><h2>Add a book</h2><input placeholder="Book title" aria-label="Book title" value={title} onChange={e=>setTitle(e.target.value)} required/><input placeholder="Author" aria-label="Author" value={author} onChange={e=>setAuthor(e.target.value)}/><button disabled={busy}>Add Book</button></form><input className="search" placeholder="Search your books…" aria-label="Search books" value={query} onChange={e=>setQuery(e.target.value)}/><div className="cards">{books.filter(b=>(b.title+' '+b.author).toLowerCase().includes(query.toLowerCase())).map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author||'Unknown author'}</p><p>{b.progress_mode==='page'&&b.page_count?`${b.current_page} / ${b.page_count} pages`:`${b.progress_percent}%`}{b.book_format?` · ${formats.find(f=>f[0]===b.book_format)?.[1]}`:''}</p><div className="bookActions"><select aria-label={'Reading status for '+b.title} value={b.status} onChange={e=>change(b,e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="subtle" onClick={()=>openEditor(b)}>Edit</button><button className="subtle" onClick={()=>remove(b)}>Delete</button></div></article>)}</div></>:
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
     <label>Format<select value={draft.book_format||''} onChange={e=>setDraft({...draft,book_format:e.target.value})}>{formats.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
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
