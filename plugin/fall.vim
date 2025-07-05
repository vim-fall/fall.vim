if exists('g:loaded_fall')
  finish
endif
let g:loaded_fall = 1
let s:sep = has('win32') ? '\' : '/'

command! -nargs=+ -complete=customlist,fall#command#Fall#complete 
      \ Fall call fall#command#Fall#call([<f-args>])
command! -nargs=? -complete=customlist,fall#command#FallResume#complete
      \ FallResume call fall#command#FallResume#call(<q-args>)

command! -nargs=0 FallCustom call fall#command#FallCustom#call()
command! -nargs=0 FallCustomReload call fall#command#FallCustomReload#call()
command! -nargs=0 FallCustomRecache call fall#command#FallCustomRecache#call()

function! s:bypass(event) abort
  let l:name = matchstr(expand('<amatch>'), '^.\+:\zs.*$')
  execute printf('doautocmd <nomodeline> User %s:%s', a:event, l:name)
endfunction

augroup fall_plugin
  autocmd! *
  autocmd User FallPickerEnter:* :
  autocmd User FallPickerLeave:* :
  autocmd User FallCustomLoaded :
  autocmd User FallCustomRecached :
  autocmd User FallPreviewRendered:* :
  autocmd User FallPickerEnterSystem:* ++nested call s:bypass('FallPickerEnter')
  autocmd User FallPickerLeaveSystem:* ++nested call s:bypass('FallPickerLeave')
augroup END

if !exists('g:fall_custom_path')
  let g:fall_custom_path = has('nvim')
        \ ? expand(join([stdpath('config'), 'fall', 'custom.ts'], s:sep))
        \ : expand(join([$HOME, '.vim', 'fall', 'custom.ts'], s:sep))
endif
