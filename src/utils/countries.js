// Complete ISO-3166 country list with common name variants.
// Used by findCountry() for word-boundary matching in pasted address strings.
//
// Design: one entry per ISO-2 code, multiple name strings per entry.
// findCountry() tests longest names first to avoid "States" matching before
// "United States of America".
//
// What NOT to add: arbitrary 2-letter ISO codes (PL, DE, FR…) — those
// collide with normal words in addresses. Only the small curated abbreviation
// list below (USA, US, UK, UAE) is matched as short tokens.

export const COUNTRIES = [
  { iso2: 'AF', names: ['Afghanistan'] },
  { iso2: 'AL', names: ['Albania', 'Shqipëri'] },
  { iso2: 'DZ', names: ['Algeria', 'Algérie'] },
  { iso2: 'AD', names: ['Andorra'] },
  { iso2: 'AO', names: ['Angola'] },
  { iso2: 'AG', names: ['Antigua and Barbuda'] },
  { iso2: 'AR', names: ['Argentina'] },
  { iso2: 'AM', names: ['Armenia', 'Hayastan'] },
  { iso2: 'AU', names: ['Australia'] },
  { iso2: 'AT', names: ['Austria', 'Österreich'] },
  { iso2: 'AZ', names: ['Azerbaijan', 'Azərbaycan'] },
  { iso2: 'BS', names: ['Bahamas', 'The Bahamas'] },
  { iso2: 'BH', names: ['Bahrain'] },
  { iso2: 'BD', names: ['Bangladesh'] },
  { iso2: 'BB', names: ['Barbados'] },
  { iso2: 'BY', names: ['Belarus', 'Byelorussia'] },
  { iso2: 'BE', names: ['Belgium', 'Belgique', 'België'] },
  { iso2: 'BZ', names: ['Belize'] },
  { iso2: 'BJ', names: ['Benin'] },
  { iso2: 'BT', names: ['Bhutan'] },
  { iso2: 'BO', names: ['Bolivia'] },
  { iso2: 'BA', names: ['Bosnia and Herzegovina', 'Bosnia', 'Herzegovina'] },
  { iso2: 'BW', names: ['Botswana'] },
  { iso2: 'BR', names: ['Brazil', 'Brasil'] },
  { iso2: 'BN', names: ['Brunei'] },
  { iso2: 'BG', names: ['Bulgaria'] },
  { iso2: 'BF', names: ['Burkina Faso'] },
  { iso2: 'BI', names: ['Burundi'] },
  { iso2: 'CV', names: ['Cape Verde', 'Cabo Verde'] },
  { iso2: 'KH', names: ['Cambodia'] },
  { iso2: 'CM', names: ['Cameroon', 'Cameroun'] },
  { iso2: 'CA', names: ['Canada'] },
  { iso2: 'CF', names: ['Central African Republic'] },
  { iso2: 'TD', names: ['Chad', 'Tchad'] },
  { iso2: 'CL', names: ['Chile'] },
  { iso2: 'CN', names: ['China'] },
  { iso2: 'CO', names: ['Colombia'] },
  { iso2: 'KM', names: ['Comoros'] },
  { iso2: 'CG', names: ['Congo', 'Republic of the Congo'] },
  { iso2: 'CD', names: ['Democratic Republic of the Congo', 'DR Congo', 'DRC'] },
  { iso2: 'CR', names: ['Costa Rica'] },
  { iso2: 'HR', names: ['Croatia', 'Hrvatska'] },
  { iso2: 'CU', names: ['Cuba'] },
  { iso2: 'CY', names: ['Cyprus', 'Kypros'] },
  { iso2: 'CZ', names: ['Czech Republic', 'Czechia', 'Česká republika', 'Česko'] },
  { iso2: 'DK', names: ['Denmark', 'Danmark'] },
  { iso2: 'DJ', names: ['Djibouti'] },
  { iso2: 'DM', names: ['Dominica'] },
  { iso2: 'DO', names: ['Dominican Republic'] },
  { iso2: 'EC', names: ['Ecuador'] },
  { iso2: 'EG', names: ['Egypt'] },
  { iso2: 'SV', names: ['El Salvador'] },
  { iso2: 'GQ', names: ['Equatorial Guinea'] },
  { iso2: 'ER', names: ['Eritrea'] },
  { iso2: 'EE', names: ['Estonia', 'Eesti'] },
  { iso2: 'SZ', names: ['Eswatini', 'Swaziland'] },
  { iso2: 'ET', names: ['Ethiopia'] },
  { iso2: 'FJ', names: ['Fiji'] },
  { iso2: 'FI', names: ['Finland', 'Suomi'] },
  { iso2: 'FR', names: ['France'] },
  { iso2: 'GA', names: ['Gabon'] },
  { iso2: 'GM', names: ['Gambia', 'The Gambia'] },
  { iso2: 'GE', names: ['Georgia', 'Sakartvelo'] },
  { iso2: 'DE', names: ['Germany', 'Deutschland'] },
  { iso2: 'GH', names: ['Ghana'] },
  { iso2: 'GR', names: ['Greece', 'Hellas', 'Ellada'] },
  { iso2: 'GD', names: ['Grenada'] },
  { iso2: 'GT', names: ['Guatemala'] },
  { iso2: 'GN', names: ['Guinea'] },
  { iso2: 'GW', names: ['Guinea-Bissau'] },
  { iso2: 'GY', names: ['Guyana'] },
  { iso2: 'HT', names: ['Haiti'] },
  { iso2: 'HN', names: ['Honduras'] },
  { iso2: 'HU', names: ['Hungary', 'Magyarország'] },
  { iso2: 'IS', names: ['Iceland', 'Ísland'] },
  { iso2: 'IN', names: ['India'] },
  { iso2: 'ID', names: ['Indonesia'] },
  { iso2: 'IR', names: ['Iran'] },
  { iso2: 'IQ', names: ['Iraq'] },
  { iso2: 'IE', names: ['Ireland', 'Éire'] },
  { iso2: 'IL', names: ['Israel'] },
  { iso2: 'IT', names: ['Italy', 'Italia'] },
  { iso2: 'JM', names: ['Jamaica'] },
  { iso2: 'JP', names: ['Japan', 'Nippon', 'Nihon'] },
  { iso2: 'JO', names: ['Jordan'] },
  { iso2: 'KZ', names: ['Kazakhstan', 'Qazaqstan'] },
  { iso2: 'KE', names: ['Kenya'] },
  { iso2: 'KI', names: ['Kiribati'] },
  { iso2: 'KW', names: ['Kuwait'] },
  { iso2: 'KG', names: ['Kyrgyzstan'] },
  { iso2: 'LA', names: ['Laos'] },
  { iso2: 'LV', names: ['Latvia', 'Latvija'] },
  { iso2: 'LB', names: ['Lebanon'] },
  { iso2: 'LS', names: ['Lesotho'] },
  { iso2: 'LR', names: ['Liberia'] },
  { iso2: 'LY', names: ['Libya'] },
  { iso2: 'LI', names: ['Liechtenstein'] },
  { iso2: 'LT', names: ['Lithuania', 'Lietuva'] },
  { iso2: 'LU', names: ['Luxembourg', 'Luxemburg'] },
  { iso2: 'MG', names: ['Madagascar'] },
  { iso2: 'MW', names: ['Malawi'] },
  { iso2: 'MY', names: ['Malaysia'] },
  { iso2: 'MV', names: ['Maldives'] },
  { iso2: 'ML', names: ['Mali'] },
  { iso2: 'MT', names: ['Malta'] },
  { iso2: 'MH', names: ['Marshall Islands'] },
  { iso2: 'MR', names: ['Mauritania', 'Mauritanie'] },
  { iso2: 'MU', names: ['Mauritius'] },
  { iso2: 'MX', names: ['Mexico', 'México'] },
  { iso2: 'FM', names: ['Micronesia'] },
  { iso2: 'MD', names: ['Moldova'] },
  { iso2: 'MC', names: ['Monaco'] },
  { iso2: 'MN', names: ['Mongolia'] },
  { iso2: 'ME', names: ['Montenegro', 'Crna Gora'] },
  { iso2: 'MA', names: ['Morocco', 'Maroc'] },
  { iso2: 'MZ', names: ['Mozambique'] },
  { iso2: 'MM', names: ['Myanmar', 'Burma'] },
  { iso2: 'NA', names: ['Namibia'] },
  { iso2: 'NR', names: ['Nauru'] },
  { iso2: 'NP', names: ['Nepal'] },
  { iso2: 'NL', names: ['Netherlands', 'Holland', 'Nederland'] },
  { iso2: 'NZ', names: ['New Zealand'] },
  { iso2: 'NI', names: ['Nicaragua'] },
  { iso2: 'NE', names: ['Niger'] },
  { iso2: 'NG', names: ['Nigeria'] },
  { iso2: 'KP', names: ['North Korea'] },
  { iso2: 'MK', names: ['North Macedonia', 'Macedonia'] },
  { iso2: 'NO', names: ['Norway', 'Norge'] },
  { iso2: 'OM', names: ['Oman'] },
  { iso2: 'PK', names: ['Pakistan'] },
  { iso2: 'PW', names: ['Palau'] },
  { iso2: 'PA', names: ['Panama', 'Panamá'] },
  { iso2: 'PG', names: ['Papua New Guinea'] },
  { iso2: 'PY', names: ['Paraguay'] },
  { iso2: 'PE', names: ['Peru', 'Perú'] },
  { iso2: 'PH', names: ['Philippines'] },
  { iso2: 'PL', names: ['Poland', 'Polska'] },
  { iso2: 'PT', names: ['Portugal'] },
  { iso2: 'QA', names: ['Qatar'] },
  { iso2: 'RO', names: ['Romania', 'România'] },
  { iso2: 'RU', names: ['Russia', 'Russian Federation'] },
  { iso2: 'RW', names: ['Rwanda'] },
  { iso2: 'KN', names: ['Saint Kitts and Nevis'] },
  { iso2: 'LC', names: ['Saint Lucia'] },
  { iso2: 'VC', names: ['Saint Vincent and the Grenadines'] },
  { iso2: 'WS', names: ['Samoa'] },
  { iso2: 'SM', names: ['San Marino'] },
  { iso2: 'ST', names: ['Sao Tome and Principe'] },
  { iso2: 'SA', names: ['Saudi Arabia'] },
  { iso2: 'SN', names: ['Senegal'] },
  { iso2: 'RS', names: ['Serbia', 'Srbija'] },
  { iso2: 'SC', names: ['Seychelles'] },
  { iso2: 'SL', names: ['Sierra Leone'] },
  { iso2: 'SG', names: ['Singapore'] },
  { iso2: 'SK', names: ['Slovakia', 'Slovensko'] },
  { iso2: 'SI', names: ['Slovenia', 'Slovenija'] },
  { iso2: 'SB', names: ['Solomon Islands'] },
  { iso2: 'SO', names: ['Somalia'] },
  { iso2: 'ZA', names: ['South Africa'] },
  { iso2: 'SS', names: ['South Sudan'] },
  { iso2: 'KR', names: ['South Korea'] },
  { iso2: 'ES', names: ['Spain', 'España'] },
  { iso2: 'LK', names: ['Sri Lanka'] },
  { iso2: 'SD', names: ['Sudan'] },
  { iso2: 'SR', names: ['Suriname'] },
  { iso2: 'SE', names: ['Sweden', 'Sverige'] },
  { iso2: 'CH', names: ['Switzerland', 'Schweiz', 'Suisse', 'Svizzera'] },
  { iso2: 'SY', names: ['Syria'] },
  { iso2: 'TW', names: ['Taiwan'] },
  { iso2: 'TJ', names: ['Tajikistan'] },
  { iso2: 'TZ', names: ['Tanzania'] },
  { iso2: 'TH', names: ['Thailand'] },
  { iso2: 'TL', names: ['Timor-Leste', 'East Timor'] },
  { iso2: 'TG', names: ['Togo'] },
  { iso2: 'TO', names: ['Tonga'] },
  { iso2: 'TT', names: ['Trinidad and Tobago'] },
  { iso2: 'TN', names: ['Tunisia', 'Tunisie'] },
  { iso2: 'TR', names: ['Turkey', 'Türkiye'] },
  { iso2: 'TM', names: ['Turkmenistan'] },
  { iso2: 'TV', names: ['Tuvalu'] },
  { iso2: 'UG', names: ['Uganda'] },
  { iso2: 'UA', names: ['Ukraine', 'Ukraina'] },
  { iso2: 'AE', names: ['United Arab Emirates'] },
  { iso2: 'GB', names: ['United Kingdom', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'] },
  { iso2: 'US', names: ['United States of America', 'United States'] },
  { iso2: 'UY', names: ['Uruguay'] },
  { iso2: 'UZ', names: ['Uzbekistan'] },
  { iso2: 'VU', names: ['Vanuatu'] },
  { iso2: 'VE', names: ['Venezuela'] },
  { iso2: 'VN', names: ['Vietnam', 'Viet Nam'] },
  { iso2: 'YE', names: ['Yemen'] },
  { iso2: 'ZM', names: ['Zambia'] },
  { iso2: 'ZW', names: ['Zimbabwe'] },
];

// Curated short abbreviations matched as whole tokens only.
// Deliberately small — "US"/"UK"/"UAE"/"USA" are unambiguous; arbitrary 2-letter
// codes like "PL", "DE", "FR" are not included (they appear in other word contexts).
const ABBREVIATIONS = [
  { iso2: 'US', names: ['USA', 'US'] },
  { iso2: 'GB', names: ['UK'] },
  { iso2: 'AE', names: ['UAE'] },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build flat candidate list sorted longest name first to prevent partial matches
// (e.g. "United States" must not fire before "United States of America").
const _candidates = [];
for (const c of COUNTRIES) {
  for (const n of c.names) _candidates.push({ iso2: c.iso2, name: n });
}
for (const a of ABBREVIATIONS) {
  for (const n of a.names) _candidates.push({ iso2: a.iso2, name: n });
}
_candidates.sort((a, b) => b.name.length - a.name.length);

// Scan text for any known country name using whole-word (word-boundary) matching.
// Returns { iso2, matchedText } or null.
// matchedText is the literal text found (preserving original casing) so the caller
// can remove it from the working string.
export function findCountry(text) {
  if (!text) return null;
  for (const { iso2, name } of _candidates) {
    const re = new RegExp('\\b' + escapeRegex(name) + '\\b', 'i');
    const m = re.exec(text);
    if (m) return { iso2, matchedText: m[0] };
  }
  return null;
}
