export function validReadingDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false
 const [y,m,d]=value.split('-').map(Number),p=new Date(Date.UTC(y,m-1,d))
 return p.getUTCFullYear()===y&&p.getUTCMonth()===m-1&&p.getUTCDate()===d
}
export function readingStatistics(books=[],sessions=[]){
 const finished=books.filter(b=>b.status==='finished')
 const byId=new Map(finished.map(b=>[b.id,b]))
 const allSessions=sessions.filter(s=>byId.has(s.book_id))
 const withSessions=new Set(allSessions.map(s=>s.book_id))
 const validSessions=allSessions.filter(s=>validReadingDate(s.finished_on)&&(!s.started_on||(validReadingDate(s.started_on)&&s.started_on<=s.finished_on)))
 const dated=[...validSessions.map(s=>({...byId.get(s.book_id),finished_on:s.finished_on,started_on:s.started_on,session_id:s.id})),...finished.filter(b=>!withSessions.has(b.id)&&validReadingDate(b.finished_on)&&(!b.started_on||(validReadingDate(b.started_on)&&b.started_on<=b.finished_on)))]
 const undated=finished.filter(b=>!withSessions.has(b.id)&&(!validReadingDate(b.finished_on)||(b.started_on&&(!validReadingDate(b.started_on)||b.started_on>b.finished_on))))
 const invalidSessionIds=new Set(allSessions.filter(s=>!validReadingDate(s.finished_on)||(s.started_on&&(!validReadingDate(s.started_on)||s.started_on>s.finished_on))).map(s=>s.book_id))
 const needsReview=finished.filter(b=>undated.some(x=>x.id===b.id)||invalidSessionIds.has(b.id))
 const pages=items=>items.reduce((sum,b)=>sum+(Number.isInteger(b.page_count)&&b.page_count>0?b.page_count:0),0)
 const average=items=>{const rated=items.filter(b=>Number.isInteger(b.rating)&&b.rating>=1&&b.rating<=5);return rated.length?(rated.reduce((sum,b)=>sum+b.rating,0)/rated.length).toFixed(1):'—'}
 const countBy=(items,key)=>items.reduce((counts,b)=>{const k=key(b);counts[k]=(counts[k]||0)+1;return counts},{})
 const forYear=year=>dated.filter(b=>Number(b.finished_on.slice(0,4))===year)
 const forMonth=(year,month)=>dated.filter(b=>Number(b.finished_on.slice(0,4))===year&&Number(b.finished_on.slice(5,7))===month)
 return {finished,dated,needsReview,withSessions,allSessions,validSessions,pages,average,countBy,forYear,forMonth,
  uniqueFinished:finished.length,completedReadings:dated.length,knownPages:pages(dated),
  missingPages:dated.filter(b=>!Number.isInteger(b.page_count)||b.page_count<1).length,
  missingDatedBooks:undated.length,
  rereads:Math.max(0,dated.length-new Set(dated.map(b=>b.id)).size)}
}
