(() => {
  const stroke = '#18181B';
  const orange = '#F97316';
  const soft = '#FFF7ED';

  const wrap = body => `<svg class="batch-line-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const p = (d, extra='') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const po = (d, extra='') => `<path d="${d}" fill="none" stroke="${orange}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

  const icons = {
    martini: () => wrap(
      p('M8 9h32L26 27v11h8M22 38h12M10 11l13 15') +
      po('M30 7l-8 13') +
      `<circle cx="31" cy="7" r="3.4" fill="${orange}"/><circle cx="22" cy="20" r="3.8" fill="${orange}"/>`
    ),
    rocks: () => wrap(
      p('M10 12h28l-2.5 27h-23z') +
      p('M14 22h20') + po('M14 27c6-2 12 2 20 0') +
      p('M16 17l7 6 6-7M24 24l6 6 5-5')
    ),
    coupe: () => wrap(
      p('M8 11h32c-1.6 10-6.6 15-16 15S9.6 21 8 11zM24 26v11M18 39h12') +
      po('M11 16h26') + `<circle cx="31" cy="14" r="3" fill="${orange}"/>`
    ),
    margarita: () => wrap(
      p('M7 12h34L29 24H19zM24 24v13M18 39h12') +
      po('M11 13h26') +
      `<path d="M34 8a7 7 0 0 1 7 7" fill="${soft}" stroke="${orange}" stroke-width="2.2"/><path d="M34 8l7 7M37 8l-1 7" stroke="${orange}" stroke-width="1.5"/>`
    ),
    highball: () => wrap(
      p('M13 7h22l-2 34H15z') + p('M17 17l7 5-5 7M27 19l5 5-5 6') +
      po('M17 31c5-2 10 2 15 0') + po('M31 5L27 15')
    ),
    mule: () => wrap(
      p('M10 16h24v23H12zM34 21h4c4 0 4 12 0 12h-4') +
      po('M13 24c5-2 12 2 19 0') + po('M19 15l4-5 4 5') + p('M17 15l2-5M27 15l4-6')
    ),
    tiki: () => wrap(
      p('M13 12h22l-3 28H16zM18 38h12') + po('M16 24c5-3 11 3 16 0') +
      po('M29 10l6-6 5 5-7 3') + po('M18 11l-3-5') + `<circle cx="18" cy="15" r="3" fill="${orange}"/>`
    ),
    spritz: () => wrap(
      p('M11 10h26l-3 15c-1 5-5 8-10 8s-9-3-10-8zM24 33v6M18 41h12') +
      po('M15 22c6-2 12 2 18 0') + `<circle cx="20" cy="18" r="1.5" fill="${orange}"/><circle cx="28" cy="16" r="1.5" fill="${orange}"/>`
    ),
    julep: () => wrap(
      p('M12 14h24l-2 26H14zM10 14h28') + po('M16 20h16') +
      po('M22 13l-4-6 6 3M26 13l4-7 3 6')
    ),
    toddy: () => wrap(
      p('M12 16h22v20H14zM34 20h4c4 0 4 10 0 10h-4M18 39h12') +
      po('M15 21h16') + po('M20 14c0-4 3-5 3-8M27 14c0-4 3-5 3-8')
    ),
    punch: () => wrap(
      p('M7 17h34c-1 14-7 19-17 19S8 31 7 17zM20 36v4M14 42h20') +
      po('M11 24c7-3 15 3 26 0') + po('M34 12l-7 15') +
      `<circle cx="18" cy="22" r="3" fill="none" stroke="${orange}" stroke-width="2"/><circle cx="29" cy="27" r="3" fill="none" stroke="${orange}" stroke-width="2"/>`
    ),
    bottle: () => wrap(
      p('M19 6h10v8l4 5v22H15V19l4-5z') + po('M19 9h10') + po('M17 27c5-2 10 2 14 0')
    ),
    bottleLarge: () => wrap(
      p('M18 5h12v9l5 6v21H13V20l5-6z') + po('M19 9h10') + po('M15 27c6-2 12 2 18 0')
    ),
    cambro: () => wrap(
      p('M8 12h32M10 15h28l-2 26H12z') + po('M13 27c6-2 12 2 22 0') + po('M31 20h4M31 24h4M31 32h4')
    ),
    custom: () => wrap(
      p('M12 12h24v28H12zM9 12h30M18 8h12') + po('M14 27c6-2 12 2 20 0') +
      p('M30 32h8v5h-8M35 37v4')
    )
  };

  function cocktailKind(recipe={}) {
    const name = String(recipe.name || '').toLowerCase();
    const glass = String(recipe.glass || '').toLowerCase();
    const style = String(recipe.style || '').toLowerCase();
    const hay = `${name} ${glass} ${style}`;

    if (/martini|martinez/.test(hay)) return 'martini';
    if (/old fashioned/.test(hay)) return 'rocks';
    if (/margarita|daisy/.test(hay)) return 'margarita';
    if (/manhattan/.test(hay)) return 'coupe';
    if (/mule|buck/.test(hay)) return 'mule';
    if (/collins|fizz|rickey|highball/.test(hay)) return 'highball';
    if (/julep|smash|maid/.test(hay)) return 'julep';
    if (/spritz|cobbler/.test(hay)) return 'spritz';
    if (/tiki|tropical/.test(hay)) return 'tiki';
    if (/toddy|coffee|hot/.test(hay)) return 'toddy';
    if (/punch/.test(hay)) return 'punch';
    if (/sour|daiquiri|fix|regal|torch light/.test(hay)) return 'coupe';
    if (/cocktail|coupe|sour/.test(glass)) return 'coupe';
    if (/rocks|whiskey/.test(glass)) return 'rocks';
    if (/collins|fizz|highball/.test(glass)) return 'highball';
    if (/julep/.test(glass)) return 'julep';
    return 'coupe';
  }

  function containerKind(button) {
    const label = String(button?.dataset?.label || button?.textContent || '').toLowerCase();
    if (button?.dataset?.customContainer === 'true') return 'custom';
    if (/750|1 l bottle/.test(label)) return 'bottle';
    if (/2 l bottle/.test(label)) return 'bottleLarge';
    if (/cambro/.test(label)) return 'cambro';
    return 'custom';
  }

  window.BatchIcons = {
    svg(name) { return (icons[name] || icons.coupe)(); },
    cocktail(recipe) { return (icons[cocktailKind(recipe)] || icons.coupe)(); },
    container(button) { return (icons[containerKind(button)] || icons.custom)(); }
  };

  document.querySelectorAll('.container-preset').forEach(button => {
    if (button.querySelector('.container-icon')) return;
    const icon = document.createElement('span');
    icon.className = 'container-icon';
    icon.innerHTML = window.BatchIcons.container(button);
    button.prepend(icon);
  });
})();