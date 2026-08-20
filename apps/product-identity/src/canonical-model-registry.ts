export interface CanonicalModelRegistryEntry {
  key: string;
  label: string;
  category: string;
  aliases: readonly string[];
  invariants?: Readonly<{ screen?: string; chip?: string }>;
  safeDefaults?: Readonly<{ connectivity?: string }>;
}

function entry(
  key: string,
  label: string,
  category: string,
  aliases: readonly string[],
  metadata: Pick<CanonicalModelRegistryEntry, 'invariants' | 'safeDefaults'> = {},
): CanonicalModelRegistryEntry {
  return { key, label, category, aliases: [...new Set([label, ...aliases])], ...metadata };
}

function iphone(
  generation: number,
  variant: '' | 'e' | 'Air' | 'Plus' | 'Pro' | 'Pro Max' = '',
) {
  const labelSuffix = variant === 'e' ? 'e' : variant ? ` ${variant}` : '';
  const aliasSuffix = variant === 'e' ? 'e' : variant.toLowerCase();
  const compactSuffix = aliasSuffix.replace(/\s+/g, '');
  const aliases = [
    `iphone ${generation}${variant === 'e' ? 'e' : aliasSuffix ? ` ${aliasSuffix}` : ''}`,
    `iphone${generation}${compactSuffix}`,
    `iphone${generation}${compactSuffix ? ` ${compactSuffix}` : ''}`,
    `iphone${generation}${aliasSuffix ? ` ${aliasSuffix}` : ''}`,
    `iph ${generation}${variant === 'e' ? 'e' : aliasSuffix ? ` ${aliasSuffix}` : ''}`,
  ];

  if (variant === 'Pro Max') {
    aliases.push(
      `${generation} pro max`,
      `${generation} promax`,
      `${generation} pm`,
      `iph ${generation} pm`,
    );
  } else if (variant) {
    aliases.push(`${generation}${variant === 'e' ? 'e' : ` ${aliasSuffix}`}`);
  }

  return entry(
    `iphone-${generation}${variant ? `-${variant.toLowerCase().replace(/\s+/g, '-')}` : ''}`,
    `iPhone ${generation}${labelSuffix}`,
    'iPhone',
    aliases,
  );
}

function macbook(
  key: string,
  label: string,
  aliases: readonly string[],
  includeScreenUnits = false,
  metadata: Pick<CanonicalModelRegistryEntry, 'invariants' | 'safeDefaults'> = {},
) {
  return entry(
    key,
    label,
    'MacBook',
    includeScreenUnits ? withScreenUnitAliases(aliases) : aliases,
    metadata,
  );
}

function imac(
  key: string,
  label: string,
  aliases: readonly string[],
) {
  return entry(key, label, 'iMac', withScreenUnitAliases(aliases));
}

function macStudio(
  key: string,
  label: string,
  aliases: readonly string[],
) {
  return entry(key, label, 'Mac Studio', aliases);
}

function withScreenUnitAliases(aliases: readonly string[]) {
  return aliases.flatMap((alias) =>
    /\s\d{2}$/.test(alias)
      ? [alias, `${alias} inch`, `${alias} polegadas`]
      : [alias],
  );
}

function ipad(
  key: string,
  label: string,
  aliases: readonly string[],
  metadata: Pick<CanonicalModelRegistryEntry, 'invariants' | 'safeDefaults'> = {},
) {
  return entry(key, label, 'iPad', aliases, {
    ...metadata,
    safeDefaults: { connectivity: 'Wi-Fi', ...metadata.safeDefaults },
  });
}

function watch(
  key: string,
  label: string,
  aliases: readonly string[],
  metadata?: Pick<CanonicalModelRegistryEntry, 'invariants' | 'safeDefaults'>,
) {
  const aliasesWithUnits = aliases.flatMap((alias) =>
    /\s\d{2}$/.test(alias) ? [alias, `${alias}mm`] : [alias],
  );
  return entry(key, label, 'Apple Watch', aliasesWithUnits, {
    ...metadata,
    safeDefaults: { connectivity: 'GPS', ...metadata?.safeDefaults },
  });
}

function accessory(
  key: string,
  label: string,
  aliases: readonly string[],
) {
  return entry(key, label, 'Acessorios', aliases);
}

export const canonicalModelRegistry: readonly CanonicalModelRegistryEntry[] = [
  iphone(11),
  iphone(11, 'Pro'),
  iphone(11, 'Pro Max'),
  iphone(12),
  iphone(12, 'Pro'),
  iphone(12, 'Pro Max'),
  iphone(13),
  iphone(13, 'Pro'),
  iphone(13, 'Pro Max'),
  iphone(14),
  iphone(14, 'Plus'),
  iphone(14, 'Pro'),
  iphone(14, 'Pro Max'),
  iphone(15),
  iphone(15, 'Plus'),
  iphone(15, 'Pro'),
  iphone(15, 'Pro Max'),
  iphone(16),
  iphone(16, 'e'),
  iphone(16, 'Plus'),
  iphone(16, 'Pro'),
  iphone(16, 'Pro Max'),
  iphone(17),
  iphone(17, 'e'),
  iphone(17, 'Air'),
  iphone(17, 'Pro'),
  iphone(17, 'Pro Max'),

  macbook('macbook-neo', 'MacBook Neo', ['macbook neo', 'mac neo']),
  macbook(
    'macbook-neo-13',
    'MacBook Neo 13"',
    [
      'macbook neo 13',
      'mac neo 13',
      'macbook neo a18 pro 13',
      'macbook neo a18 pro 13"',
      'mac neo a18 pro 13',
      'mac neo a18 pro 13"',
    ],
    true,
    { invariants: { screen: '13"', chip: 'A18 Pro' } },
  ),
  macbook('macbook-air-m4-13', 'MacBook Air M4 13"', ['macbook air m4 13', 'mac air m4 13'], false, {
    invariants: { chip: 'M4', screen: '13"' },
  }),
  macbook('macbook-air-m4-15', 'MacBook Air M4 15"', ['macbook air m4 15', 'mac air m4 15'], false, {
    invariants: { chip: 'M4', screen: '15"' },
  }),
  macbook('macbook-air-m5-13', 'MacBook Air M5 13"', ['macbook air m5 13', 'mac air m5 13'], false, {
    invariants: { chip: 'M5', screen: '13"' },
  }),
  macbook('macbook-air-m5-15', 'MacBook Air M5 15"', ['macbook air m5 15', 'mac air m5 15'], false, {
    invariants: { chip: 'M5', screen: '15"' },
  }),
  macbook('macbook-pro-m4-pro-14', 'MacBook Pro M4 Pro 14"', ['macbook pro m4 pro 14', 'mac pro m4 pro 14'], false, {
    invariants: { chip: 'M4 Pro', screen: '14"' },
  }),
  macbook('macbook-pro-m4-pro-16', 'MacBook Pro M4 Pro 16"', ['macbook pro m4 pro 16', 'mac pro m4 pro 16'], false, {
    invariants: { chip: 'M4 Pro', screen: '16"' },
  }),
  macbook('macbook-pro-m5-14', 'MacBook Pro M5 14"', ['macbook pro m5 14', 'mac pro m5 14'], false, {
    invariants: { chip: 'M5', screen: '14"' },
  }),
  macbook('macbook-pro-m5-pro-14', 'MacBook Pro M5 Pro 14"', ['macbook pro m5 pro 14', 'mac pro m5 pro 14'], false, {
    invariants: { chip: 'M5 Pro', screen: '14"' },
  }),
  macbook('macbook-pro-m5-pro-16', 'MacBook Pro M5 Pro 16"', ['macbook pro m5 pro 16', 'mac pro m5 pro 16'], false, {
    invariants: { chip: 'M5 Pro', screen: '16"' },
  }),
  macbook('macbook-pro-m5-max-14', 'MacBook Pro M5 Max 14"', ['macbook pro m5 max 14', 'mac pro m5 max 14'], false, {
    invariants: { chip: 'M5 Max', screen: '14"' },
  }),
  macbook('macbook-pro-m5-max-16', 'MacBook Pro M5 Max 16"', ['macbook pro m5 max 16', 'mac pro m5 max 16'], false, {
    invariants: { chip: 'M5 Max', screen: '16"' },
  }),
  macbook('mac-mini-m2', 'Mac Mini M2', ['mac mini m2']),
  macbook('mac-mini-m4', 'Mac Mini M4', ['mac mini m4']),
  macbook('mac-mini-m4-pro', 'Mac Mini M4 Pro', ['mac mini m4 pro']),
  imac('imac-m4-24', 'iMac M4 24"', ['imac m4 24']),
  imac('imac-m5-24', 'iMac M5 24"', ['imac m5 24']),
  macStudio('mac-studio-m3-ultra', 'Mac Studio M3 Ultra', ['mac studio m3 ultra']),
  macStudio('mac-studio-m4-max', 'Mac Studio M4 Max', ['mac studio m4 max']),
  macStudio('mac-studio-m4-ultra', 'Mac Studio M4 Ultra', ['mac studio m4 ultra']),

  ipad('ipad-10', 'iPad 10', ['ipad 10']),
  ipad('ipad-11', 'iPad 11', ['ipad 11', 'ipad a16'], {
    invariants: { chip: 'A16', screen: '11"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),
  ipad('ipad-air-m4-11', 'iPad Air M4 11"', ['ipad air m4 11'], {
    invariants: { chip: 'M4', screen: '11"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),
  ipad('ipad-air-m4-13', 'iPad Air M4 13"', ['ipad air m4 13'], {
    invariants: { chip: 'M4', screen: '13"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),
  ipad('ipad-pro-m4-11', 'iPad Pro M4 11"', ['ipad pro m4 11'], {
    invariants: { chip: 'M4', screen: '11"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),
  ipad('ipad-pro-m4-13', 'iPad Pro M4 13"', ['ipad pro m4 13'], {
    invariants: { chip: 'M4', screen: '13"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),
  ipad('ipad-pro-m5-11', 'iPad Pro M5 11"', ['ipad pro m5 11'], {
    invariants: { chip: 'M5', screen: '11"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),
  ipad('ipad-pro-m5-13', 'iPad Pro M5 13"', ['ipad pro m5 13'], {
    invariants: { chip: 'M5', screen: '13"' },
    safeDefaults: { connectivity: 'Wi-Fi' },
  }),

  watch('apple-watch-series-11-42', 'Apple Watch Series 11 42mm', ['apple watch series 11 42', 'apple watch s11 42', 'watch s11 42', 'series 11 42', 's11 42']),
  watch('apple-watch-series-11-46', 'Apple Watch Series 11 46mm', ['apple watch series 11 46', 'apple watch s11 46', 'watch s11 46', 'series 11 46', 's11 46']),
  watch('apple-watch-se-2-40', 'Apple Watch SE 2 40mm', ['apple watch se 2 40', 'apple watch se2 40', 'watch se2 40', 'se2 40']),
  watch('apple-watch-se-2-44', 'Apple Watch SE 2 44mm', ['apple watch se 2 44', 'apple watch se2 44', 'watch se2 44', 'se2 44']),
  watch('apple-watch-se-3-40', 'Apple Watch SE 3 40mm', ['apple watch se 3 40', 'apple watch se3 40', 'watch se3 40', 'se3 40'], { safeDefaults: { connectivity: 'GPS' } }),
  watch('apple-watch-se-3-44', 'Apple Watch SE 3 44mm', ['apple watch se 3 44', 'apple watch se3 44', 'watch se3 44', 'se3 44']),
  watch('apple-watch-ultra-2-49', 'Apple Watch Ultra 2 49mm', ['apple watch ultra 2 49', 'watch ultra 2 49', 'ultra 2 49']),
  watch('apple-watch-ultra-3-49', 'Apple Watch Ultra 3 49mm', ['apple watch ultra 3 49', 'watch ultra 3 49', 'ultra 3 49']),

  accessory('airpods', 'AirPods', ['airpods', 'air pods']),
  accessory('airpods-2', 'AirPods 2', ['airpods 2', 'air pods 2']),
  accessory('airpods-4', 'AirPods 4', ['airpods 4', 'air pods 4']),
  accessory('airpods-pro-2', 'AirPods Pro 2', ['airpods pro 2', 'air pods pro 2']),
  accessory('airpods-pro-3', 'AirPods Pro 3', ['airpods pro 3', 'air pods pro 3']),
  accessory('airpods-max', 'AirPods Max', ['airpods max', 'air pods max']),
  accessory('earpods', 'EarPods', ['earpods', 'ear pods']),
  accessory('apple-pencil', 'Apple Pencil', ['apple pencil', 'pencil apple']),
  accessory('apple-pencil-1', 'Apple Pencil 1', ['apple pencil 1', 'pencil 1']),
  accessory('apple-pencil-2', 'Apple Pencil 2', ['apple pencil 2', 'pencil 2']),
  accessory('apple-pencil-usb-c', 'Apple Pencil USB-C', ['apple pencil usb c', 'pencil usb c', 'pencil usbc']),
  accessory('apple-pencil-pro', 'Apple Pencil Pro', ['apple pencil pro', 'pencil pro']),
  accessory('magic-mouse', 'Magic Mouse', ['magic mouse']),
  accessory('magic-mouse-1', 'Magic Mouse 1', ['magic mouse 1', 'magic mouse 1g']),
  accessory('magic-mouse-2', 'Magic Mouse 2', ['magic mouse 2', 'magic mouse 2g']),
  accessory('magic-mouse-3', 'Magic Mouse 3', ['magic mouse 3', 'magic mouse 3g']),
  accessory('magic-keyboard', 'Magic Keyboard', ['magic keyboard']),
  accessory('airtag', 'AirTag', ['apple airtag', 'airtag']),
  accessory('apple-charger-20w-usb-c', 'Carregador Apple 20W USB-C', [
    'carregador apple 20w usb c',
  ]),
  accessory('apple-cable-usb-c', 'Cabo Apple USB-C', ['cabo apple usb c']),
] as const;
