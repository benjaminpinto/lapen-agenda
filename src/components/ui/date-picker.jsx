import * as React from "react"
import {Calendar as CalendarIcon} from "lucide-react"
import {Calendar} from "@/components/ui/calendar"

const DatePicker = ({value, onChange, placeholder = "Pick a date", disabled, ...props}) => {
    const [isOpen, setIsOpen] = React.useState(false)
    
    // Parse date string to local date object
    const selectedDate = value ? (() => {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day)
    })() : undefined

    const handleSelect = (date) => {
        if (date) {
            // Format date in local timezone
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const formattedDate = `${year}-${month}-${day}`
            onChange?.(formattedDate)
        }
        setIsOpen(false)
    }

    const formatDate = (date) => {
        if (!date) return ""
        return date.toLocaleDateString('pt-BR')
    }

    return (
        <div className="relative">
            <div
                tabIndex={0}
                className="flex h-10 w-full items-center justify-start rounded-md border border-gray-200 bg-white px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                onFocus={() => setIsOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setIsOpen(true)
                    }
                }}
            >
                <CalendarIcon className="mr-2 h-4 w-4"/>
                {selectedDate ? formatDate(selectedDate) : placeholder}
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="bg-white rounded-lg shadow-lg p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleSelect}
                            disabled={(date) => {
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)
                                return date < today
                            }}
                            {...props}
                        />
                        <button
                            onClick={() => setIsOpen(false)}
                            className="mt-2 px-4 py-2 bg-gray-200 rounded"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export {DatePicker}