# 🍂 Fall

[![Test](https://github.com/vim-fall/fall.vim/actions/workflows/test.yml/badge.svg)](https://github.com/vim-fall/fall.vim/actions/workflows/test.yml)
[![Deno](https://img.shields.io/badge/Deno%202.x-333?logo=deno&logoColor=fff)](#)
[![codecov](https://codecov.io/gh/vim-fall/fall.vim/graph/badge.svg?token=k2ZTes7Kln)](https://codecov.io/gh/vim-fall/fall.vim)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Vim Help](https://img.shields.io/badge/vim-%3Ah%20fall-orange.svg)](doc/fall.txt)

<div align="center">

![vim-fall's screencast](https://github.com/user-attachments/assets/c4f3d336-073c-44e2-ba36-2f7e282b78b7)<br>
<sup>Fall with
[vim-glyph-pallet](https://github.com/lambdalisue/vim-glyph-palette) (Colors on
glyphs) on [DawnFox](https://github.com/EdenEast/nightfox.nvim) (Vim's
colorscheme)</sup>

</div>

Fall is a powerful, flexible fuzzy finder framework for Vim and Neovim,
implemented in [Denops], and stands for **"Filter All."** It provides an
extensible architecture that allows users to search, filter, and act on various
data sources including files, buffers, lines, help tags, and more through a
unified interface.

## Key Features

- **Extensible Architecture**: Modular design allows custom sources, matchers,
  sorters, renderers, and previewers
- **Interactive Interface**: Quick help via F1, real-time filtering, and action
  selection
- **Multiple Processing Stages**: Sophisticated pipeline with collection,
  matching, sorting, rendering, and preview stages
- **Session Management**: Save and resume picker sessions with `:FallSession`
  and `:FallResume`
- **Submatch Capabilities**: Refine searches with multiple filter criteria
- **Performance Optimized**: Asynchronous processing with intelligent scheduling
  and chunking
- **Rich Customization**: Configure behavior through TypeScript extensions and
  Vim script settings

See [Features](https://github.com/vim-fall/fall.vim/wiki/Features) for more
detailed information.

> [!WARNING]
>
> This is a beta version. Please be aware that there might be
> backward-incompatible changes.

[Denops]: https://github.com/vim-denops/denops.vim

## Requirements

Users must install [Deno] version 2.x. Additionally, the `nerdfont` renderer is
enabled by default, so configure your terminal to use a [NerdFont], or disable
it by removing the `builtin.renderer.nerdfont` renderer from the custom file and
use non `builtin.theme.modern.MODERN_THEME` theme (`:FallCustom`).

[Deno]: https://deno.land
[NerdFont]: https://www.nerdfonts.com

Note that Deno version 1.x is not tested and not supported.

## Installation

To install [Denops] and this plugin using your preferred plugin manager, such as
[vim-plug], add the following lines to your Vim configuration:

```vim
Plug 'vim-denops/denops.vim'
Plug 'vim-fall/fall.vim'
```

[vim-plug]: https://github.com/junegunn/vim-plug

## Usage

Use the `:Fall` command to open the fuzzy finder. The command accepts the
following arguments:

```
Fall {source} {source_args}...
```

### Common Examples

```vim
" Find files in current directory
:Fall file

" Find files in specific directory
:Fall file /path/to/directory

" Search file contents with grep
:Fall grep

" Search in git repository
:Fall git-grep

" Search with ripgrep (faster)
:Fall rg

" Filter lines in current buffer
:Fall line

" Filter lines in specific file
:Fall line README.md

" Switch between buffers
:Fall buffer

" Browse help tags
:Fall help

" Browse command history
:Fall history

" Resume previous picker
:FallResume

" Manage picker sessions
:FallSession
```

### Mappings

![Fall Vim README Image](https://github.com/user-attachments/assets/4eb4db30-ee1e-458c-b619-765cf307a74c)

Users can view available mappings by pressing `<F1>` in the picker window. See
the [Mappings](https://github.com/vim-fall/fall.vim/wiki/Mappings) page for more
details.

### Configuration

In Fall, settings that utilize Vim’s built-in functionality are categorized as
“Configuration.” This includes key mappings, highlights, and buffer option
modifications.

Refer to the
[Configuration](https://github.com/vim-fall/fall.vim/wiki/Configuration) page on
the GitHub Wiki for more details.

### Customization

In Fall, settings written in TypeScript to enhance Fall’s functionality are
categorized as “Customization.” These specifically refer to modifications made
to the user customization file, which can be accessed via the `FallCustom`
command.

Visit the
[Customization](https://github.com/vim-fall/fall.vim/wiki/Customization) page on
the GitHub Wiki for more information.

## Architecture

Fall follows a modular architecture with these core components:

- **Sources**: Data providers (files, buffers, grep results, etc.)
- **Matchers**: Filter algorithms (fuzzy, substring, regex)
- **Sorters**: Result ordering strategies (alphabetical, length, score)
- **Renderers**: Display formatters (with optional NerdFont icons)
- **Previewers**: Content preview generators
- **Actions**: Operations on selected items (open, edit, split, etc.)

Components communicate through a well-defined pipeline, allowing for extensive
customization and extension.

## Related Projects

| Repository                                                                | Package                                               | Description                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| [vim-fall/deno-fall-core](https://github.com/vim-fall/deno-fall-core)     | [`@vim-fall/core`](https://jsr.io/@vim-fall/core)     | Core types and interfaces for Fall extensions |
| [vim-fall/deno-fall-custom](https://github.com/vim-fall/deno-fall-custom) | [`@vim-fall/custom`](https://jsr.io/@vim-fall/custom) | Customization utilities and helpers           |
| [vim-fall/deno-fall-std](https://github.com/vim-fall/deno-fall-std)       | [`@vim-fall/std`](https://jsr.io/@vim-fall/std)       | Standard built-in components                  |
| [vim-fall/deno-fall-extra](https://github.com/vim-fall/deno-fall-extra)   | [`@vim-fall/extra`](https://jsr.io/@vim-fall/extra)   | Additional sources and extensions             |

## Similar Projects

- [ddu.vim](https://github.com/Shougo/ddu.vim)<br>A highly customizable and
  extensible fuzzy finder for Vim/Neovim written in Denops.
- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim)<br>The de
  facto standard fuzzy finder for Neovim.
- [ctrlp.vim](https://github.com/ctrlpvim/ctrlp.vim)<br>A classic and famous
  fuzzy finder for Vim.

## License

The code in this repository follows the MIT license, as detailed in
[LICENSE](./LICENSE). Contributors must agree that any modifications submitted
to this repository also adhere to the license.
