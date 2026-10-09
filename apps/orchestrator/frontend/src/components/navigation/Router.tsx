import React, { createContext, useContext, useState, useEffect } from 'react'

interface RouterContextType {
    path: string
    navigate: (to: string) => void
}

const RouterContext = createContext<RouterContextType>({
    path: window.location.pathname,
    navigate: () => {},
})

export const Router: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [path, setPath] = useState<string>(window.location.pathname)

    useEffect(() => {
        const handlePopState = () => {
            setPath(window.location.pathname)
        }
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    const navigate = (to: string) => {
        window.history.pushState({}, '', to)
        setPath(to)
    }

    return (
        <RouterContext.Provider value={{ path, navigate }}>
            {children}
        </RouterContext.Provider>
    )
}

export const useLocation = () => {
    const { path } = useContext(RouterContext)
    return { pathname: path }
}

export const useNavigate = () => {
    const { navigate } = useContext(RouterContext)
    return navigate
}

export const Link: React.FC<{
    to: string
    children: React.ReactNode
    className?: string
}> = ({ to, children, className }) => {
    const { navigate } = useContext(RouterContext)
    return (
        <a
            href={to}
            className={className}
            onClick={(e) => {
                e.preventDefault()
                navigate(to)
            }}
        >
            {children}
        </a>
    )
}

export const Route: React.FC<{
    path: string
    element: React.ReactNode
}> = ({ element }) => {
    return <>{element}</>
}

export const Routes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { path } = useContext(RouterContext)
    let match: React.ReactNode = null

    React.Children.forEach(children, (child) => {
        if (!match && React.isValidElement(child)) {
            const childPath = child.props.path
            if (childPath === path || (childPath === '/' && path === '')) {
                match = child
            }
        }
    })

    return <>{match}</>
}
