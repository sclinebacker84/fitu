const params = new URLSearchParams(window.location.search)

const {h,render,Component} = window.preact

class Container extends Component {
	constructor(props){
		super(props)
		window.addEventListener('resize',() => {
			this.handleResize()
		})
	}
	handleResize(){
		this.setState(this.state)
	}
	render(){
		return h('div',{class:'container bg-dark text-center',style:'height: 100%'},
			h('img',{class:'img-responsive',style:`height:100% ; z-index: 1 ; position: fixed ; left: ${Math.round(window.innerWidth/65)}%`,src:'img/logo.png'}),
			h('div',{class:'columns',style:'z-index: -1'},
				h('div',{class:'column col-6'},
					h('h4',undefined,'Trainers')
				),
				h('div',{class:'column col-6'},
					h('h4',undefined,'Students')
				)
			)
		)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))