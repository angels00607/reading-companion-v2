export function parseStoryGraphCSV(source){
 const rows=[];let row=[],field='',quoted=false
 for(let i=0;i<source.length;i++){
  const ch=source[i]
  if(quoted){if(ch==='"'&&source[i+1]==='"'){field+='"';i++}else if(ch==='"')quoted=false;else field+=ch}
  else if(ch==='"')quoted=true
  else if(ch===','){row.push(field);field=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))rows.push(row);row=[]}
  else field+=ch
 }
 if(quoted)throw new Error('CSV has an unclosed quoted field.')
 row.push(field);if(row.some(x=>x.trim()))rows.push(row)
 if(rows.length<2)throw new Error('CSV must include a header and at least one book.')
 const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const [y,m,d]=value.split('-').map(Number),parsed=new Date(Date.UTC(y,m-1,d))
  return parsed.getUTCFullYear()===y&&parsed.getUTCMonth()===m-1&&parsed.getUTCDate()===d
 }
 const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]/g,''))
 const find=(record,...keys)=>{for(const key of keys){const i=headers.indexOf(key.toLowerCase().replace(/[^a-z0-9]/g,''));if(i>=0&&record[i]?.trim())return record[i].trim()}return ''}
 if(!headers.includes('title')||!headers.some(h=>h==='authors'||h==='author'))throw new Error('This CSV does not have recognizable StoryGraph Title and Authors columns.')
 return rows.map((r,index)=>{
  const title=find(r,'Title'),author=find(r,'Authors','Author')
  const statusRaw=find(r,'Read Status','Status').trim().toLowerCase()
  const status=statusRaw.includes('did not finish')||statusRaw==='did-not-finish'||statusRaw==='dnf'?'dnf':statusRaw.includes('currently reading')||statusRaw==='reading'?'reading':statusRaw==='read'||statusRaw==='finished'?'finished':statusRaw==='to-read'||statusRaw==='to read'||statusRaw==='to_read'||statusRaw==='to-read shelf'?'to_read':null
  const pagesRaw=find(r,'Number of Pages','Pages','Page Count')
  const pages=/^\d+$/.test(pagesRaw)&&Number(pagesRaw)>0&&Number(pagesRaw)<=100000?Number(pagesRaw):null
  const dateRaw=find(r,'Last Date Read','Date Read','Date Finished','Finished Date')
  const normalizeDate=value=>/^\d{4}\/\d{2}\/\d{2}$/.test(value)?value.replace(/\//g,'-'):value
  const finishedOn=validDate(normalizeDate(dateRaw))?normalizeDate(dateRaw):null
  const datesRead=find(r,'Dates Read')
  const readCountRaw=find(r,'Read Count')
  const readCount=/^\d+$/.test(readCountRaw)?Number(readCountRaw):null
  const sessions=datesRead.split(',').map(part=>part.trim()).filter(Boolean).map(part=>{
   const match=part.match(/^(\d{4}[\/-]\d{2}[\/-]\d{2})(?:\s*-\s*(\d{4}[\/-]\d{2}[\/-]\d{2}))?$/)
   if(!match)return null
   const started=normalizeDate(match[1]),finished=normalizeDate(match[2]||match[1])
   return validDate(started)&&validDate(finished)&&started<=finished?{started_on:started,finished_on:finished}:null
  })
  const completeSessions=sessions.filter(Boolean).filter((s,index,array)=>array.findIndex(other=>other.started_on===s.started_on&&other.finished_on===s.finished_on)===index)
  if(status==='finished'&&finishedOn&&!completeSessions.some(s=>s.finished_on===finishedOn))completeSessions.push({started_on:null,finished_on:finishedOn})
  const ratingRaw=find(r,'Star Rating','Rating')
  const rating=ratingRaw!==''&&Number.isInteger(Number(ratingRaw))&&Number(ratingRaw)>=1&&Number(ratingRaw)<=5?Number(ratingRaw):null
  const isbn=find(r,'ISBN/UID','ISBN','ISBN13').replace(/[^0-9Xx]/g,'')
  const warnings=[]
  if(!status)warnings.push('Unrecognized reading status')
  if(dateRaw&&!finishedOn)warnings.push('Invalid finish date')
  if(status==='finished'&&!dateRaw)warnings.push('Missing finish date (needed for yearly statistics)')
  if(status==='finished'&&sessions.some(s=>!s))warnings.push('Unrecognized reading session dates')
  if(status==='finished'&&completeSessions.length<sessions.filter(Boolean).length)warnings.push('Duplicate reading sessions in CSV: review before import')
  if(status==='finished'&&readCount!==null&&readCount>completeSessions.length)warnings.push('Some reading sessions have no dates')
  if(ratingRaw&&rating===null)warnings.push('Rating not a whole star (1–5)')
  if(pagesRaw&&!pages)warnings.push('Invalid page count')
  return {row:index+2,title,author,status,warnings,pages,raw_pages:pagesRaw,raw_date:finishedOn||dateRaw,raw_rating:ratingRaw,raw_status:statusRaw,read_count:readCount,dates_read:datesRead,sessionParseIssues:sessions.some(s=>!s),sessionDuplicates:completeSessions.length<sessions.filter(Boolean).length,sessions:status==='finished'?completeSessions:[],finished_on:status==='finished'?finishedOn:null,rating:status==='finished'?rating:null,isbn_13:/^\d{13}$/.test(isbn)?isbn:null,isbn_10:/^\d{9}[0-9Xx]$/.test(isbn)?isbn:null}
 }).filter(x=>x.title)
}
