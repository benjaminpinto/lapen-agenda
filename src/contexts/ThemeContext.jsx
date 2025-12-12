import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext({
    theme: "light",
    setTheme: () => null,
})

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
    ...props
}) {
    const [theme, setTheme] = useState(defaultTheme)

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")

        // Force light mode always
        root.classList.add("light")
        return

        root.classList.add(theme)
    }, [theme])

    const value = {
        theme,
        setTheme: (theme) => {
            setTheme(theme)
        },
    }

    return (
        <ThemeContext.Provider {...props} value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
