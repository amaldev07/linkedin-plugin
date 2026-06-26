 let ar = [2, 2, 5, 1, 3, 2, 4, 1]
 
 let uniqEls = [];
 let largestEl = ar[0];
 for(let i=0;i<ar.length;i++){
  let curEl = ar[i];
  
  if(curEl>largestEl) largestEl=curEl; 

  if(!uniqEls.includes(curEl)){
    uniqEls.push(curEl);
  }
  
 }