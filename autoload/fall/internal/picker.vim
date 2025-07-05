function! fall#internal#picker#setup() abort
  call fall#internal#tolerant#call({ -> fall#internal#msgarea#hide() })
  call fall#internal#tolerant#call({ -> fall#internal#cursor#hide() })
  call fall#internal#mapping#store()
endfunction

function! fall#internal#picker#teardown() abort
  call fall#internal#tolerant#call({ -> fall#internal#msgarea#show() })
  call fall#internal#tolerant#call({ -> fall#internal#cursor#show() })
  call fall#internal#tolerant#call({ -> fall#internal#mapping#restore() })
  call fall#internal#tolerant#call({ -> fall#internal#popup#closeall() })
endfunction
