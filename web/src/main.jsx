import React, {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './supabase'
import './style.css'

const tabs=['Home','Library','Journal','Challenges','Statistics']
const accent={Home:'#8364AC',Library:'#695080',Journal:'#B76C9D',Challenges:'#417CA5',Statistics:'#315C87'}
const statuses=[['to_read','To Read'],['reading','Currently Reading'],['finished','Finished'],['dnf','DNF']]
function App(){
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('')
 const [tab,setTab]=useState('Home'),[books,setBooks]=useState([]),[title,setTitle]=useState(''),[author,setAuthor]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[dark,setDark]=useState(false)
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return ()=>subscription.unsubscribe()},[])
 async function load(){if(!session)return;const {data,error}=await supabase.from('rc_books').select('id,title,author,status,updated_at').order('created_at',{ascending:false});if(error)setMessage(error.message);else setBooks(data)}
 useEffect(()=>{if(session)load();else setBooks([])},[session?.user?.id])
 useEffect(()=>{const onFocus=()=>{if(session)load()};const onVisible=()=>{if(document.visibilityState==='visible'&&session)load()};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[session])
 async function auth(mode){setBusy(true);setMessage('');const {error}=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});setBusy(false);setMessage(error?error.message:mode==='signup'?'Account created. Check your email if confirmation is required.':'')}
 async function add(e){e.preventDefault();if(!title.trim())return;setBusy(true);const {error}=await supabase.from('rc_books').insert({title:title.trim(),author:author.trim(),user_id:session.user.id});setBusy(false);if(error)setMessage(error.message);else{setTitle('');setAuthor('');await load()}}
 async function change(book,status){const {error}=await supabase.from('rc_books').update({status}).eq('id',book.id);if(error)setMessage(error.message);else await load()}
 async function remove(book){if(!confirm('Delete this book?'))return;const {error}=await supabase.from('rc_books').delete().eq('id',book.id);if(error)setMessage(error.message);else await load()}
 return <div className={dark?'app dark':'app'} style={{'--accent':accent[tab]}}>
  <header><div><small>READING COMPANION</small><h1>{tab}</h1></div><button className="subtle" onClick={()=>setDark(!dark)} aria-label="Toggle dark mode">{dark?'☀':'☾'}</button></header>
  {!ready?<main>Loading…</main>:!session?<main className="auth"><h2>Your reading space</h2><p>Sign in to keep your books together on iPhone and Mac.</p><form onSubmit={e=>{e.preventDefault();auth('login')}}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy}>Sign in</button><button type="button" className="secondary" disabled={busy} onClick={()=>auth('signup')}>Create account</button></form></main>:
  <main>
   <div className="account"><span>{session.user.email}</span><div><button className="subtle" onClick={load}>↻ Sync</button><button className="subtle" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></div>
   {tab==='Home'?<><div className="hero"><small>YOUR READING SPACE</small><h2>Your next chapter starts here</h2><p>{books.filter(b=>b.status==='reading').length} currently reading · {books.length} books in your library</p></div><h2>Currently Reading</h2><div className="cards">{books.filter(b=>b.status==='reading').map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author}</p></article>)}{!books.some(b=>b.status==='reading')&&<p>No books in progress yet.</p>}</div></>:
   tab==='Library'?<><form className="add" onSubmit={add}><h2>Add a book</h2><input placeholder="Book title" aria-label="Book title" value={title} onChange={e=>setTitle(e.target.value)} required/><input placeholder="Author" aria-label="Author" value={author} onChange={e=>setAuthor(e.target.value)}/><button disabled={busy}>Add Book</button></form><input className="search" placeholder="Search your books…" aria-label="Search books" value={query} onChange={e=>setQuery(e.target.value)}/><div className="cards">{books.filter(b=>(b.title+' '+b.author).toLowerCase().includes(query.toLowerCase())).map(b=><article key={b.id}><strong>{b.title}</strong><p>{b.author||'Unknown author'}</p><div className="bookActions"><select aria-label={'Reading status for '+b.title} value={b.status} onChange={e=>change(b,e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="subtle" onClick={()=>remove(b)}>Delete</button></div></article>)}</div></>:
   <div className="hero"><h2>{tab} is coming soon</h2><p>The library comes first. This section will be added without unnecessary complexity.</p></div>}
  </main>}
  {message&&<p role="status" className="message">{message}<button className="subtle" onClick={()=>setMessage('')}>×</button></p>}
  <nav aria-label="Main navigation">{tabs.map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''} style={{'--item':accent[t]}}>{t}</button>)}</nav>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>)
