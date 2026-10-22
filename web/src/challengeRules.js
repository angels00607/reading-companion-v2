export function challengeVariant(year){return Number(year)%2===0?'A':'B'}
export function challengeYears(books=[],sessions=[],current=new Date().getFullYear()){
 return [...new Set([current,...books.filter(b=>b.status==='finished').map(b=>Number(b.finished_on?.slice(0,4))),...sessions.map(s=>Number(s.finished_on?.slice(0,4)))] .filter(y=>Number.isInteger(y)&&y>=2020&&y<=2100))].sort((a,b)=>b-a)
}
export function eligibleChallengeBooks(books=[],sessions=[],year){
 const sessionDates=new Map()
 for(const s of sessions){if(/^\d{4}-\d{2}-\d{2}$/.test(s.finished_on||'')){if(!sessionDates.has(s.book_id))sessionDates.set(s.book_id,[]);sessionDates.get(s.book_id).push(s.finished_on)}}
 return books.filter(b=>b.status==='finished'&&(sessionDates.has(b.id)?sessionDates.get(b.id).some(d=>d.startsWith(String(year))):b.finished_on?.startsWith(String(year))))
}
export function eligibleChallengeBooksForMonth(books=[],sessions=[],year,months=[]){
 const allowed=new Set(months)
 const dates=new Map()
 for(const s of sessions){if(/^\d{4}-\d{2}-\d{2}$/.test(s.finished_on||'')){if(!dates.has(s.book_id))dates.set(s.book_id,[]);dates.get(s.book_id).push(s.finished_on)}}
 return books.filter(b=>b.status==='finished'&&(dates.has(b.id)?dates.get(b.id):[b.finished_on]).some(d=>d?.startsWith(String(year))&&allowed.has(Number(d.slice(5,7)))))
}
