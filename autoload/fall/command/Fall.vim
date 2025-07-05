function! fall#command#Fall#call(args) abort
  if denops#plugin#wait('fall') isnot# 0
    return
  endif
  try
    call fall#internal#picker#setup()
    call denops#request('fall', 'picker:command', [a:args])
  finally
    call fall#internal#picker#teardown()
  endtry
endfunction

function! fall#command#Fall#complete(arglead, cmdline, cursorpos) abort
  if denops#plugin#wait('fall') isnot# 0
    return []
  endif
  return denops#request('fall', 'picker:command:complete', [a:arglead, a:cmdline, a:cursorpos])
endfunction
