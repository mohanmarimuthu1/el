import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ChevronDown, Plus, Search, Check } from 'lucide-react'

export default function SearchableDropdown({ category, value, onChange, placeholder = 'Search or type new...' }) {
    const [options, setOptions] = useState([])
    const [search, setSearch] = useState('')
    const [open, setOpen] = useState(false)
    const [adding, setAdding] = useState(false)
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        fetchOptions()
    }, [category])

    // Close on outside click
    useEffect(() => {
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    async function fetchOptions() {
        const { data } = await supabase
            .from('lookup_values')
            .select('id, value')
            .eq('category', category)
            .order('value')
        setOptions(data || [])
    }

    const filtered = options.filter(o =>
        o.value.toLowerCase().includes(search.toLowerCase())
    )

    const exactMatch = options.some(o => o.value.toLowerCase() === search.toLowerCase())
    const showAddOption = search.trim() && !exactMatch

    async function handleAddNew() {
        if (!search.trim() || adding) return
        setAdding(true)
        const { data, error } = await supabase
            .from('lookup_values')
            .insert({ category, value: search.trim() })
            .select('id, value')
            .single()

        if (!error && data) {
            setOptions(prev => [...prev, data].sort((a, b) => a.value.localeCompare(b.value)))
            onChange(data.value)
            setSearch('')
            setOpen(false)
        }
        setAdding(false)
    }

    function handleSelect(val) {
        onChange(val)
        setSearch('')
        setOpen(false)
    }

    return (
        <div ref={containerRef} className="relative">
            <div
                className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm rounded-xl border bg-white cursor-pointer transition-all ${
                    open 
                        ? 'border-brand-400 ring-2 ring-brand-500/20' 
                        : 'border-surface-200 hover:border-surface-300'
                }`}
                onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            >
                {open ? (
                    <>
                        <Search size={14} className="text-surface-400 shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-surface-900 placeholder:text-surface-300"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && showAddOption) {
                                    e.preventDefault()
                                    handleAddNew()
                                }
                                if (e.key === 'Escape') setOpen(false)
                            }}
                        />
                    </>
                ) : (
                    <>
                        <span className={`flex-1 truncate ${value ? 'text-surface-900 font-medium' : 'text-surface-400'}`}>
                            {value || placeholder}
                        </span>
                        <ChevronDown size={14} className="text-surface-400 shrink-0" />
                    </>
                )}
            </div>

            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-surface-200 shadow-xl shadow-surface-900/10 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    {filtered.length === 0 && !showAddOption && (
                        <div className="px-4 py-3 text-xs text-surface-400 text-center">
                            No options found. Type to add new.
                        </div>
                    )}

                    {showAddOption && (
                        <button
                            type="button"
                            onClick={handleAddNew}
                            disabled={adding}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-brand-600 font-semibold hover:bg-brand-50 transition-colors border-b border-surface-100"
                        >
                            <Plus size={14} />
                            Add "{search.trim()}"
                        </button>
                    )}

                    {filtered.map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => handleSelect(o.value)}
                            className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-50 transition-colors text-left ${
                                value === o.value ? 'text-brand-600 font-semibold bg-brand-50/50' : 'text-surface-700'
                            }`}
                        >
                            {o.value}
                            {value === o.value && <Check size={14} className="text-brand-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
