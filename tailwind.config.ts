import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'sans': ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
				'logo': ['Pacifico', 'cursive'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				brand: {
					green: 'hsl(var(--brand-green))',
					'dark-green': 'hsl(var(--brand-dark-green))',
					'light-green': 'hsl(var(--brand-light-green))',
					'off-white': 'hsl(var(--brand-off-white))',
					yellow: 'hsl(var(--brand-yellow))',
					'yellow-light': 'hsl(var(--brand-yellow-light))',
					'yellow-dark': 'hsl(var(--brand-yellow-dark))',
					lime: 'hsl(var(--brand-lime))',
					'lime-light': 'hsl(var(--brand-lime-light))',
					'lime-dark': 'hsl(var(--brand-lime-dark))',
					pink: 'hsl(var(--brand-pink))',
					'pink-light': 'hsl(var(--brand-pink-light))',
					'pink-dark': 'hsl(var(--brand-pink-dark))',
					orange: 'hsl(var(--brand-orange))',
					'orange-light': 'hsl(var(--brand-orange-light))',
					'orange-dark': 'hsl(var(--brand-orange-dark))',
					violet: 'hsl(var(--brand-violet))',
					'violet-light': 'hsl(var(--brand-violet-light))',
					'violet-dark': 'hsl(var(--brand-violet-dark))',
					purple: 'hsl(var(--brand-purple))',
					'purple-light': 'hsl(var(--brand-purple-light))',
					'purple-dark': 'hsl(var(--brand-purple-dark))',
					blue: 'hsl(var(--brand-blue))',
					'blue-light': 'hsl(var(--brand-blue-light))',
					'blue-dark': 'hsl(var(--brand-blue-dark))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			},
			spacing: {
				'safe-top': 'var(--sat)',
				'safe-right': 'var(--sar)',
				'safe-bottom': 'var(--sab)',
				'safe-left': 'var(--sal)',
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
