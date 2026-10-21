import React, {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import './style.css'

const tabs=['Home','Library','Journal','Challenges','Statistics']
const accent={Home:'#8364AC',Library:'#695080',Journal:'#B76C9D',Challenges:'#417CA5',Statistics:'#315C87'}
const formats=[['','Not selected'],['paperback','Paperback'],['hardcover','Hardcover'],['ebook','E-book'],['audiobook','Audiobook']]
const statuses=[['to_read','To Read'],['reading','Currently Reading'],['finished','Finished'],['dnf','DNF']]
function App(){
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('')
 const [editing,setEditing]=useState(null),[draft,setDraft]=useState(null)
 const [tab,setTab]=useState('Home'),[books,setBooks]=useState([]),[title,setTitle]=useState(''),[author,setAuthor]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[dark,setDark]=useState(false)
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return ()=>subscription.unsubscribe()},[])
 async function load(){if(!session)return;const {data,error}=await supabase.from('rc_books').select('id,title,author,status,updated_at,page_count,current_page,progress_percent,progress_mode,book_format').order('created_at',{ascending:false});if(error)setMessage(error.message);else setBooks(data)}
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
   tab==='Library'?<><form className="add" onSubmit={add}><h2>Add a book</h2><input placeholder="Book title" aria-label="Book title" value={title} onChange={e=>setTitle(e.target.value)} required/><input placeholder="Author" aria-label="Author" value={author} onChange={e=>setAuthor(e.target.value)}/><button disabled={busy}>Add Book</button></form><input className="search" placeholder="Search your books…" aria-label="Search books" value={query} onChange={e=>setQuery(e.target.value)}/><div className="cards">{books.filter(b=>(b.title+' '+b.author).toLowerCase().includes(query.toLowerCase())).map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author||'Unknown author'}</p><p>{b.progress_mode==='page'&&b.page_count?`${b.current_page} / ${b.page_count} pages`:`${b.progress_percent}%`}{b.book_format?` · ${formats.find(f=>f[0]===b.book_format)?.[1]}`:''}</p><div className="bookActions"><select aria-label={'Reading status for '+b.title} value={b.status} onChange={e=>change(b,e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="subtle" onClick={()=>openEditor(b)}>Edit</button><button className="subtle" onClick={()=>remove(b)}>Delete</button></div></article>)}</div></>:
   <div className="hero"><h2>{tab} is coming soon</h2><p>The library comes first. This section will be added without unnecessary complexity.</p></div>}
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
