// Element factory.
// Metin her zaman `textContent` ile yazılır; `innerHTML` hiçbir yerde kullanılmaz (kural 900).

type Child = Node | string | number | null | undefined | false;

export interface ElementProps {
  class?: string;
  text?: string | number;
  title?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  hidden?: boolean;
  role?: string;
  href?: string;
  min?: string;
  max?: string;
  rows?: string;
  name?: string;
  dataset?: Record<string, string>;
  aria?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (event: never) => void>>;
}

export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);

  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = String(props.text);
  if (props.title) element.title = props.title;
  if (props.role) element.setAttribute('role', props.role);
  if (props.hidden) element.hidden = true;

  if (props.type && 'type' in element) (element as unknown as { type: string }).type = props.type;
  if (props.value !== undefined && 'value' in element) (element as unknown as { value: string }).value = props.value;
  if (props.placeholder && 'placeholder' in element) {
    (element as unknown as { placeholder: string }).placeholder = props.placeholder;
  }
  if (props.disabled && 'disabled' in element) (element as unknown as { disabled: boolean }).disabled = true;
  if (props.checked && 'checked' in element) (element as unknown as { checked: boolean }).checked = true;
  if (props.name && 'name' in element) (element as unknown as { name: string }).name = props.name;
  if (props.href && 'href' in element) (element as unknown as { href: string }).href = props.href;
  if (props.min) element.setAttribute('min', props.min);
  if (props.max) element.setAttribute('max', props.max);
  if (props.rows) element.setAttribute('rows', props.rows);

  Object.entries(props.dataset ?? {}).forEach(([key, value]) => {
    element.dataset[key] = value;
  });

  Object.entries(props.aria ?? {}).forEach(([key, value]) => {
    element.setAttribute(key.startsWith('aria-') ? key : `aria-${key}`, value);
  });

  Object.entries(props.on ?? {}).forEach(([event, listener]) => {
    element.addEventListener(event, listener as EventListener);
  });

  children.forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    element.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  });

  return element;
};

export const clear = (element: HTMLElement): void => {
  while (element.firstChild) element.removeChild(element.firstChild);
};

export const setText = (element: HTMLElement, text: string): void => {
  if (element.textContent !== text) element.textContent = text;
};

export const toggleClass = (element: HTMLElement, name: string, on: boolean): void => {
  element.classList.toggle(name, on);
};

export const button = (
  label: string,
  onClick: () => void,
  props: ElementProps = {},
): HTMLButtonElement => h('button', {
  ...props,
  type: 'button',
  class: props.class ?? 'drsim-button',
  text: label,
  on: { click: onClick },
});
