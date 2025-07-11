import { tab, tbody, td, th, thead, tr } from './primitives/elements';

const padding = '0.5rem';
const color = 'inherit';
export function table(columns: string[], rows: Array<any[]>) {
  return tab([
    thead([tr(columns.map((c) => th([c], { style: { 'text-align': 'left', padding, color } })), {style: { 'border-bottom-color': color, 'border-bottom-style': 'solid', 'border-top-style': 'none', 'border-left-style': 'none', 'border-right-style': 'none'}})]),
    tbody(
      rows.map((row, i) =>
        tr(
          row.map((cell) => td([cell], { style: { padding, color } })),
          { style: { 'background-color': i % 2 ? '' : 'rgba(0, 0, 0, 0.2)', padding, color } }
        )
      )
    ),
  ], {style: { 'border-collapse': 'collapse', width: '100%', color}});
}
