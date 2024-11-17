function! fall#command#FallCustomReload#call() abort
  if denops#plugin#wait('fall') isnot# 0
    return
  endif
  call denops#notify('fall', 'custom:reload', [])
endfunction