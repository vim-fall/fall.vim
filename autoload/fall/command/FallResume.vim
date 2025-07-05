function! fall#command#FallResume#call(filter) abort
  if denops#plugin#wait('fall') isnot# 0
    return
  endif
  let l:laststatus_saved = &laststatus
  try
    call s:hide()
    call fall#internal#mapping#store()
    call denops#request('fall', 'picker:resume:command', [a:filter])
  finally
    call s:show()
    call fall#internal#tolerant#call({ -> fall#internal#mapping#restore() })
    call fall#internal#tolerant#call({ -> fall#internal#popup#closeall() })
  endtry
endfunction

function! fall#command#FallResume#complete(arglead, cmdline, cursorpos) abort
  if denops#plugin#wait('fall') isnot# 0
    return []
  endif
  return denops#request('fall', 'picker:resume:command:complete', [a:arglead, a:cmdline, a:cursorpos])
endfunction

function! s:hide() abort
  call fall#internal#tolerant#call({ -> fall#internal#msgarea#hide() })
  call fall#internal#tolerant#call({ -> fall#internal#cursor#hide() })
endfunction

function! s:show() abort
  call fall#internal#tolerant#call({ -> fall#internal#msgarea#show() })
  call fall#internal#tolerant#call({ -> fall#internal#cursor#show() })
endfunction
