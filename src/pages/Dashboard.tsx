import React, { useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import update from 'immutability-helper'
import { DashboardCard } from '../components/Dashboard/DashboardCard'
import { DashboardTotalEarnings } from '../components/Dashboard/DashboardTotalEarnings'
import { DarshboardZapEarnings } from '../components/Dashboard/DashboardZapEarnings'
import { DarshboardPaidContentSales } from '../components/Dashboard/DashboardPaidContentSales'
import { DashboardPostsEngagement } from '../components/Dashboard/DashboardPostsEngagement'
import { DarshboardUserDemographics } from '../components/Dashboard/DashboardUserDemographics'
import { DashboardUserInfluenceGraph } from '../components/Dashboard/DashboardUserInfluenceGraph'
import '../components/Dashboard/Dashboard.css'

interface Card {
  id: number
  content: React.ReactNode
}

const Dashboard: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([
    { id: 2, content: <DashboardTotalEarnings /> },
    { id: 3, content: <DarshboardZapEarnings /> },
    { id: 4, content: <DarshboardPaidContentSales /> },
    { id: 5, content: <DashboardPostsEngagement /> },
    { id: 6, content: <DarshboardUserDemographics /> },
    { id: 7, content: <DashboardUserInfluenceGraph /> },
  ])

  const moveCard = (id: number, atIndex: number) => {
    const { card, index } = findCard(id)
    setCards(
      update(cards, {
        $splice: [
          [index, 1],
          [atIndex, 0, card],
        ],
      })
    )
  }

  const findCard = (id: number) => {
    const card = cards.filter((c) => c.id === id)[0]
    return {
      card,
      index: cards.indexOf(card),
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="py-6 sm:px-4 bg-white dark:bg-black min-h-screen">
        <h2 className="text-2xl px-2 font-bold mb-4 text-gray-700 dark:text-gray-300">
          Dashboard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <DashboardCard
              key={card.id}
              id={card.id}
              moveCard={moveCard}
              findCard={findCard}
            >
              {card.content}
            </DashboardCard>
          ))}
        </div>
      </div>
    </DndProvider>
  )
}

export default Dashboard
