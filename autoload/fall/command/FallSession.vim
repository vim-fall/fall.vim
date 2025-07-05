function! fall#command#FallSession#call() abort
  if denops#plugin#wait('fall') isnot# 0
    return
  endif
  try
    call fall#internal#picker#setup()
    call denops#request('fall', 'picker:session:command', [])
  finally
    call fall#internal#picker#teardown()
  endtry
endfunction
