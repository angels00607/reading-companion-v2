export function achievements(books=[],sessions=[]){
 const finished=books.filter(b=>b.status==='finished')
 const finishedIds=new Set(finished.map(b=>b.id))
 const valid=sessions.filter(s=>finishedIds.has(s.book_id)&&/^\d{4}-\d{2}-\d{2}$/.test(s.finished_on||''))
 const withSessions=new Set(sessions.filter(s=>finishedIds.has(s.book_id)).map(s=>s.book_id))
 const completions=[...valid,...finished.filter(b=>!withSessions.has(b.id)&&/^\d{4}-\d{2}-\d{2}$/.test(b.finished_on||'')).map(b=>({book_id:b.id,finished_on:b.finished_on}))]
 const years=[...new Set(completions.map(s=>s.finished_on.slice(0,4)))].sort()
 const counts=new Map();for(const s of completions)counts.set(s.book_id,(counts.get(s.book_id)||0)+1)
 const rereads=[...counts.values()].reduce((n,count)=>n+Math.max(0,count-1),0)
 const items=[
  {id:'first',name:'First Chapter',description:'Finish your first book',target:1,value:finished.length},
  {id:'ten',name:'Book Explorer',description:'Finish 10 books',target:10,value:finished.length},
  {id:'fifty',name:'Library Legend',description:'Finish 50 books',target:50,value:finished.length},
  {id:'hundred',name:'Century Reader',description:'Finish 100 books',target:100,value:finished.length},
  {id:'reread',name:'Second Chapter',description:'Complete your first dated reread',target:1,value:rereads},
  {id:'favorites',name:'Heart Collector',description:'Mark 5 finished books as favorites',target:5,value:finished.filter(b=>b.favorite).length},
  {id:'years',name:'Reading Seasons',description:'Finish a book in 3 different calendar years',target:3,value:years.length}
 ]
 return items.map(x=>({...x,unlocked:x.value>=x.target,progress:Math.min(100,Math.round(x.value/x.target*100))}))
}
export function monthlyQuests(books=[],sessions=[],year=new Date().getFullYear(),month=new Date().getMonth()+1){
 const finished=books.filter(b=>b.status==='finished')
 const byId=new Map(finished.map(b=>[b.id,b]))
 const withSessions=new Set(sessions.filter(s=>byId.has(s.book_id)).map(s=>s.book_id))
 const period=String(year)+'-'+String(month).padStart(2,'0')
 const completions=[...sessions.filter(s=>byId.has(s.book_id)&&s.finished_on?.startsWith(period)).map(s=>byId.get(s.book_id)),...finished.filter(b=>!withSessions.has(b.id)&&b.finished_on?.startsWith(period))]
 const count=completions.length
 const pages=completions.reduce((n,b)=>n+(Number.isInteger(b.page_count)&&b.page_count>0?b.page_count:0),0)
 return [
  {id:'finish-one',name:'Finish a chapter',description:'Complete one reading this month',value:count,target:1},
  {id:'finish-three',name:'Reading rhythm',description:'Complete three readings this month',value:count,target:3},
  {id:'read-pages',name:'Page turner',description:'Complete 500 known pages this month',value:pages,target:500}
 ].map(q=>({...q,completed:q.value>=q.target,progress:Math.min(100,Math.round(q.value/q.target*100))}))
}
