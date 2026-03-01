export function numeroALetras(
  num: number,
  genero: 'masculino' | 'femenino' = 'masculino'
): string {

  const unidades = [
    '', 'uno', 'dos', 'tres', 'cuatro', 'cinco',
    'seis', 'siete', 'ocho', 'nueve'
  ];

  const especiales: { [key: number]: string } = {
    10: 'diez',
    11: 'once',
    12: 'doce',
    13: 'trece',
    14: 'catorce',
    15: 'quince',
    20: 'veinte'
  };

  const decenas = [
    '', '', 'veinte', 'treinta', 'cuarenta',
    'cincuenta', 'sesenta', 'setenta',
    'ochenta', 'noventa'
  ];

  let resultado = '';

  if (num < 10) {
    resultado = unidades[num];

  } else if (especiales[num]) {
    resultado = especiales[num];

  } else if (num < 20) {
    resultado = 'dieci' + unidades[num - 10];

  } else if (num < 30) {
    resultado = 'veinti' + unidades[num - 20];

  } else if (num < 100) {
    const d = Math.floor(num / 10);
    const r = num % 10;

    resultado = r === 0
      ? decenas[d]
      : `${decenas[d]} y ${unidades[r]}`;

  } else if (num < 1000) {
    const c = Math.floor(num / 100);
    const r = num % 100;

    const centenas: { [key: number]: string } = {
      1: 'ciento',
      2: 'doscientos',
      3: 'trescientos',
      4: 'cuatrocientos',
      5: 'quinientos',
      6: 'seiscientos',
      7: 'setecientos',
      8: 'ochocientos',
      9: 'novecientos'
    };

    if (num === 100) {
      resultado = 'cien';
    } else {
      resultado = r === 0
        ? centenas[c]
        : `${centenas[c]} ${numeroALetras(r, genero)}`;
    }

  } else if (num < 1000000) {
    const miles = Math.floor(num / 1000);
    const r = num % 1000;

    const milesTexto = miles === 1
      ? 'mil'
      : `${numeroALetras(miles, genero)} mil`;

    resultado = r === 0
      ? milesTexto
      : `${milesTexto} ${numeroALetras(r, genero)}`;

  } else {
    resultado = num.toString();
  }

  // 👇 Aquí aplicamos ajuste de género SOLO al final
  if (genero === 'femenino') {
    resultado = resultado
      .replace(/uno$/, 'una')
      .replace(/veintiuno$/, 'veintiuna')
      .replace(/ y uno$/, ' y una');
  }

  return resultado;
}