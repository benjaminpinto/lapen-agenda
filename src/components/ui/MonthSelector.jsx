import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MonthSelector = ({ selectedMonth, selectedYear, onMonthChange }) => {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    const handlePrevious = () => {
        if (selectedMonth === 1) {
            onMonthChange(12, selectedYear - 1)
        } else {
            onMonthChange(selectedMonth - 1, selectedYear)
        }
    }

    const handleNext = () => {
        if (selectedMonth === 12) {
            onMonthChange(1, selectedYear + 1)
        } else {
            onMonthChange(selectedMonth + 1, selectedYear)
        }
    }

    return (
        <div className="flex items-center justify-center space-x-4 mb-4">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[180px] text-center">
                {monthNames[selectedMonth - 1]} {selectedYear}
            </h3>
            <Button variant="outline" size="sm" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

export default MonthSelector