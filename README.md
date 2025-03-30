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

Fall is a fuzzy finder for Vim and Neovim, implemented in [Denops], and stands
for **"Filter All."**

See [Features](https://github.com/vim-fall/fall.vim/wiki/Features) for more
information about Fall's features.

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

For example, if you'd like to use the `file` source, you can use the following:

```
Fall file
```

Or use the `line` source with `README.md` as an argument:

```
Fall line README.md
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

## Related Projects

| Repository                                                                | Package                                               | Description                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| [vim-fall/deno-fall-core](https://github.com/vim-fall/deno-fall-core)     | [`@vim-fall/core`](https://jsr.io/@vim-fall/core)     | Core types for Fall. Not meant for external use. |
| [vim-fall/deno-fall-custom](https://github.com/vim-fall/deno-fall-custom) | [`@vim-fall/custom`](https://jsr.io/@vim-fall/custom) | Library to customize Fall.                       |
| [vim-fall/deno-fall-std](https://github.com/vim-fall/deno-fall-std)       | [`@vim-fall/std`](https://jsr.io/@vim-fall/std)       | Standard library for using Fall.                 |
| [vim-fall/deno-fall-extra](https://github.com/vim-fall/deno-fall-extra)   | [`@vim-fall/extra`](https://jsr.io/@vim-fall/extra)   | Extra library for using Fall.                    |

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
