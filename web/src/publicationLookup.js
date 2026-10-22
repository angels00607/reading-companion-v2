export function publicationCandidates(items,book){
 const title=(book?.title||'').trim().toLocaleLowerCase()
 const isbn=[book?.isbn_13,book?.isbn_10].filter(Boolean)
 return (items||[]).flatMap(item=>{
  const v=item.volumeInfo||{}
  const date=v.publishedDate||''
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return []
  const actual=new Date(date+'T12:00:00Z')
  if(!Number.isFinite(actual.getTime())||actual.toISOString().slice(0,10)!==date)return []
  const ids=(v.industryIdentifiers||[]).map(i=>i.identifier)
  const isbnMatch=isbn.some(id=>ids.includes(id))
  const titleMatch=(v.title||'').trim().toLocaleLowerCase()===title
  if(!isbnMatch&&!titleMatch)return []
  return [{id:item.id,date,title:v.title||'',authors:v.authors||[],publisher:v.publisher||'',isbnMatch,link:/^https:\/\//.test(v.infoLink||'')?v.infoLink:null}]
 }).sort((a,b)=>Number(b.isbnMatch)-Number(a.isbnMatch)||b.date.localeCompare(a.date))
}
export async function findPublicationCandidates(book,fetcher=fetch){
 const isbn=book?.isbn_13||book?.isbn_10
 const query=isbn?'isbn:'+isbn:'intitle:'+book.title+(book.author?' inauthor:'+book.author:'')
 const url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(query)+'&maxResults=20&printType=books'
 const response=await fetcher(url)
 if(!response.ok)throw Error('Google Books lookup failed ('+response.status+')')
 const data=await response.json()
 return publicationCandidates(data.items,book)
}
