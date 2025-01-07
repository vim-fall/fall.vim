if exists('g:loaded_fall_mapping')
  finish
endif
let g:loaded_fall_mapping = 1

function! s:dispatch(event) abort
  call fall#internal#dispatch(a:event)
endfunction

" List
cnoremap <silent> <Plug>(fall-list-first) <Cmd>call <SID>dispatch(#{type: 'move-cursor-at', cursor: 0})<CR>
cnoremap <silent> <Plug>(fall-list-last) <Cmd>call <SID>dispatch(#{type: 'move-cursor-at', cursor: '$'})<CR>
cnoremap <silent> <Plug>(fall-list-prev) <Cmd>call <SID>dispatch(#{type: 'move-cursor', amount: -1})<CR>
cnoremap <silent> <Plug>(fall-list-next) <Cmd>call <SID>dispatch(#{type: 'move-cursor', amount: 1})<CR>
cnoremap <silent> <Plug>(fall-list-prev:scroll) <Cmd>call <SID>dispatch(#{type: 'move-cursor', amount: -1, scroll: v:true})<CR>
cnoremap <silent> <Plug>(fall-list-next:scroll) <Cmd>call <SID>dispatch(#{type: 'move-cursor', amount: 1, scroll: v:true})<CR>
cnoremap <silent> <Plug>(fall-list-left) <Cmd>call <SID>dispatch(#{type: 'list-component-execute', command: 'silent! normal! zh'})<CR>
cnoremap <silent> <Plug>(fall-list-right) <Cmd>call <SID>dispatch(#{type: 'list-component-execute', command: 'silent! normal! zl'})<CR>
cnoremap <silent> <Plug>(fall-list-left:scroll) <Cmd>call <SID>dispatch(#{type: 'list-component-execute', command: 'silent! normal! zH'})<CR>
cnoremap <silent> <Plug>(fall-list-right:scroll) <Cmd>call <SID>dispatch(#{type: 'list-component-execute', command: 'silent! normal! zL'})<CR>

" Select
cnoremap <silent> <Plug>(fall-select) <Cmd>call <SID>dispatch(#{type: 'select-item'})<CR>
cnoremap <silent> <Plug>(fall-select-all) <Cmd>call <SID>dispatch(#{type: 'select-all-items'})<CR>

" Switch
cnoremap <silent> <Plug>(fall-switch-matcher-first) <Cmd>call <SID>dispatch(#{type: 'switch-matcher-at', index: 0})<CR>
cnoremap <silent> <Plug>(fall-switch-matcher-last) <Cmd>call <SID>dispatch(#{type: 'switch-matcher-at', index: '$'})<CR>
cnoremap <silent> <Plug>(fall-switch-matcher-prev) <Cmd>call <SID>dispatch(#{type: 'switch-matcher', amount: -1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-matcher-next) <Cmd>call <SID>dispatch(#{type: 'switch-matcher', amount: 1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-sorter-first) <Cmd>call <SID>dispatch(#{type: 'switch-sorter-at', index: 0})<CR>
cnoremap <silent> <Plug>(fall-switch-sorter-last) <Cmd>call <SID>dispatch(#{type: 'switch-sorter-at', index: '$'})<CR>
cnoremap <silent> <Plug>(fall-switch-sorter-prev) <Cmd>call <SID>dispatch(#{type: 'switch-sorter', amount: -1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-sorter-next) <Cmd>call <SID>dispatch(#{type: 'switch-sorter', amount: 1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-renderer-first) <Cmd>call <SID>dispatch(#{type: 'switch-renderer-at', index: 0})<CR>
cnoremap <silent> <Plug>(fall-switch-renderer-last) <Cmd>call <SID>dispatch(#{type: 'switch-renderer-at', index: '$'})<CR>
cnoremap <silent> <Plug>(fall-switch-renderer-prev) <Cmd>call <SID>dispatch(#{type: 'switch-renderer', amount: -1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-renderer-next) <Cmd>call <SID>dispatch(#{type: 'switch-renderer', amount: 1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-previewer-first) <Cmd>call <SID>dispatch(#{type: 'switch-previewer-at', index: 0})<CR>
cnoremap <silent> <Plug>(fall-switch-previewer-last) <Cmd>call <SID>dispatch(#{type: 'switch-previewer-at', index: '$'})<CR>
cnoremap <silent> <Plug>(fall-switch-previewer-prev) <Cmd>call <SID>dispatch(#{type: 'switch-previewer', amount: -1, cycle: v:true})<CR>
cnoremap <silent> <Plug>(fall-switch-previewer-next) <Cmd>call <SID>dispatch(#{type: 'switch-previewer', amount: 1, cycle: v:true})<CR>

" Preview
cnoremap <silent> <Plug>(fall-preview-first) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! gg'})<CR>
cnoremap <silent> <Plug>(fall-preview-last) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! G'})<CR>
cnoremap <silent> <Plug>(fall-preview-prev) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! k'})<CR>
cnoremap <silent> <Plug>(fall-preview-next) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! j'})<CR>
cnoremap <silent> <Plug>(fall-preview-prev:scroll) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! <C-u>'})<CR>
cnoremap <silent> <Plug>(fall-preview-next:scroll) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! <C-d>'})<CR>
cnoremap <silent> <Plug>(fall-preview-left) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! zh'})<CR>
cnoremap <silent> <Plug>(fall-preview-right) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! zl'})<CR>
cnoremap <silent> <Plug>(fall-preview-left:scroll) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! zH'})<CR>
cnoremap <silent> <Plug>(fall-preview-right:scroll) <Cmd>call <SID>dispatch(#{type: 'preview-component-execute', command: 'silent! normal! zL'})<CR>

" Help
cnoremap <silent> <Plug>(fall-help) <Cmd>call <SID>dispatch(#{type: 'help-component-toggle'})<CR>
cnoremap <silent> <Plug>(fall-help-prev) <Cmd>call <SID>dispatch(#{type: 'help-component-page', amount: -1})<CR>
cnoremap <silent> <Plug>(fall-help-next) <Cmd>call <SID>dispatch(#{type: 'help-component-page', amount: 1})<CR>

" Action
cnoremap <silent> <Plug>(fall-action-select) <Cmd>call fall#action('@select')<CR>

if !get(g:, 'fall_disable_default_mapping')
  function! s:define(lhs, rhs) abort
    execute 'cnoremap <silent> <nowait> ' .. a:lhs .. ' ' .. a:rhs
  endfunction

  function! s:map_picker() abort
    " List
    call s:define('<C-t>', '<Plug>(fall-list-first)')
    call s:define('<C-g>', '<Plug>(fall-list-last)')
    call s:define('<C-p>', '<Plug>(fall-list-prev)')
    call s:define('<C-n>', '<Plug>(fall-list-next)')
    call s:define('<C-u>', '<Plug>(fall-list-prev:scroll)')
    call s:define('<C-d>', '<Plug>(fall-list-next:scroll)')
    call s:define('<PageUp>', '<Plug>(fall-list-left)')
    call s:define('<PageDown>', '<Plug>(fall-list-right)')
    call s:define('<S-PageUp>', '<Plug>(fall-list-left:scroll)')
    call s:define('<S-PageDown>', '<Plug>(fall-list-right:scroll)')
    call s:define('<C-,>', '<Plug>(fall-select)')
    call s:define('<C-.>', '<Plug>(fall-select-all)')
    call s:define('<C-j>', '<Plug>(fall-select)<Plug>(fall-list-next)')
    call s:define('<C-k>', '<Plug>(fall-list-prev)<Plug>(fall-select)')
    " Preview
    call s:define('<M-Home>', '<Plug>(fall-preview-first)')
    call s:define('<M-End>', '<Plug>(fall-preview-last)')
    call s:define('<M-Up>', '<Plug>(fall-preview-prev)')
    call s:define('<M-Down>', '<Plug>(fall-preview-next)')
    call s:define('<S-Up>', '<Plug>(fall-preview-prev:scroll)')
    call s:define('<S-Down>', '<Plug>(fall-preview-next:scroll)')
    call s:define('<M-Left>', '<Plug>(fall-preview-left)')
    call s:define('<M-Right>', '<Plug>(fall-preview-right)')
    call s:define('<S-Left>', '<Plug>(fall-preview-left:scroll)')
    call s:define('<S-Right>', '<Plug>(fall-preview-right:scroll)')
    " Action
    call s:define('<Tab>', '<Plug>(fall-action-select)')
    " Help
    call s:define('<F1>', '<Plug>(fall-help)')
    call s:define('<S-Home>', '<Plug>(fall-help-prev)')
    call s:define('<S-End>', '<Plug>(fall-help-next)')
    " Switch
    call s:define('<F2>', '<Plug>(fall-switch-matcher-next)')
    call s:define('<F3>', '<Plug>(fall-switch-sorter-next)')
    call s:define('<F4>', '<Plug>(fall-switch-renderer-next)')
    call s:define('<F5>', '<Plug>(fall-switch-previewer-next)')
  endfunction

  augroup fall_mapping_plugin
    autocmd!
    autocmd User FallPickerEnter:* call s:map_picker()
  augroup END
endif
