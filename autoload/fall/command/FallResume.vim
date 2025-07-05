function! fall#command#FallResume#call(filter) abort
  if denops#plugin#wait('fall') isnot# 0
    return
  endif
  try
    call fall#internal#picker#setup()
    call denops#request('fall', 'picker:resume:command', [a:filter])
  finally
    call fall#internal#picker#teardown()
  endtry
endfunction

function! fall#command#FallResume#complete(arglead, cmdline, cursorpos) abort
  if denops#plugin#wait('fall') isnot# 0
    return []
  endif
  return denops#request('fall', 'picker:resume:command:complete', [a:arglead, a:cmdline, a:cursorpos])
endfunction
