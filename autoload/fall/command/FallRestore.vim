function! fall#command#FallRestore#call() abort
  if denops#plugin#wait('fall') isnot# 0
    return
  endif
  let l:laststatus_saved = &laststatus
  try
    set laststatus=0
    call fall#internal#cursor#hide()
    call fall#internal#msgarea#hide()
    call fall#internal#mapping#store()
    call denops#request('fall', 'picker:restore', [])
  finally
    silent! call fall#internal#mapping#restore()
    silent! call fall#internal#msgarea#show()
    silent! call fall#internal#cursor#show()
    " Close all popup windows in case of denops death
    silent! call fall#internal#popup#close(g:_fall_component_preview_winid)
    silent! call fall#internal#popup#close(g:_fall_component_select_winid)
    silent! call fall#internal#popup#close(g:_fall_component_query_winid)
    silent! call fall#internal#popup#close(g:_fall_component_input_winid)
    silent! let &laststatus = l:laststatus_saved
  endtry
endfunction
